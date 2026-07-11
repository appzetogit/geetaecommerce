import { createContext, useContext, useState, ReactNode, useMemo, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Cart, CartItem } from '../types/cart';
import { Product } from '../types/domain';
import {
  getCart,
  addToCart as apiAddToCart,
  updateCartItem as apiUpdateCartItem,
  removeFromCart as apiRemoveFromCart,
  clearCart as apiClearCart
} from '../services/api/customerCartService';
import { getApplicableUnitPrice, getCartItemVariantSelector, getCartLineUnitPrice } from '../utils/priceUtils';
import { getCustomerFreeGiftRules } from '../services/api/customerFreeGiftService';
import { CartRewardRule, getGiftRules, normalizeCartRewardRule } from '../utils/freeGiftRuleUtils';

const CART_STORAGE_KEY = 'saved_cart';

interface AddToCartEvent {
  product: Product;
  sourcePosition?: { x: number; y: number };
}

interface CartContextType {
  cart: Cart;
  addToCart: (product: Product, sourceElement?: HTMLElement | null, options?: { source?: string, sourceId?: string }) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number, variantId?: string, variantTitle?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  lastAddEvent: AddToCartEvent | null;
  loading: boolean;
  freeGiftRules: CartRewardRule[];
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Extended interface to include Cart Item ID
interface ExtendedCartItem extends CartItem {
  id?: string;
  isFreeGift?: boolean;
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage for persistence on refresh
  const [items, setItems] = useState<ExtendedCartItem[]>(() => {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Filter out items with null/undefined products (corrupted localStorage data)
        return Array.isArray(parsed) ? parsed.filter((item: any) => item?.product) : [];
      } catch (e) {
        console.error("Failed to parse saved cart", e);
      }
    }
    return [];
  });
  const [lastAddEvent, setLastAddEvent] = useState<AddToCartEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [freeGiftRules, setFreeGiftRules] = useState<CartRewardRule[]>([]);
  const pendingOperationsRef = useRef<Set<string>>(new Set());

  const { isAuthenticated, user } = useAuth();
  const { location } = useLocation();

  // Mirror of `items` always pointing at the latest value. Used by the
  // auth-transition effect below so it can read the cart contents at the
  // exact moment of login without re-running on every `items` change.
  const itemsRef = useRef<ExtendedCartItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Guards against repeatedly merging the same set of guest items if React
  // re-runs the auth effect (e.g. StrictMode in dev, or transient auth
  // flickers). We treat each login transition as a single merge attempt.
  const hasMergedGuestCartRef = useRef(false);

  // Sync cart from backend on mount or when user logs in.
  //
  // Guest cart merge:
  // -----------------
  // If the user added products as a guest (items live in local state +
  // localStorage and have NO backend `id`), we must push them to the
  // server-side cart on login instead of letting `fetchCart` silently
  // overwrite them with the user's saved cart. We replay each guest item
  // through the existing addToCart endpoint, which already dedupes by
  // (cart, product, variation) and sums quantities — so a guest who had
  // product P x1 and a logged-in cart that already contained product P x2
  // ends up with P x3 after merge.
  useEffect(() => {
    if (isAuthenticated) {
      const guestItems = (itemsRef.current || []).filter(
        (i) => i?.product && !i.id && !i.isFreeGift
      );
      if (guestItems.length > 0 && !hasMergedGuestCartRef.current) {
        hasMergedGuestCartRef.current = true;
        void mergeGuestCartIntoServer(guestItems);
      } else {
        fetchCart();
      }
    } else {
      // Reset so a future login (after logout) can merge again.
      hasMergedGuestCartRef.current = false;
      setLoading(false);
    }
    fetchFreeGiftRules();
  }, [isAuthenticated]);

  const fetchCart = async () => {
    setLoading(true);
    try {
      const res = await getCart({
        latitude: location?.latitude,
        longitude: location?.longitude
      });
      if (res.success && res.data) {
        setItems(mapApiItemsToState(res.data.items));
      }
    } catch (e) {
      console.error("Failed to fetch cart", e);
    } finally {
      setLoading(false);
    }
  };

  // Replay every guest item through the server-side addToCart endpoint, then
  // pull the merged cart back. Sequential POSTs avoid write contention on the
  // same Cart document (each call rewrites cart.total + saves). Failures on
  // individual items (e.g. product was deactivated while the user was a
  // guest) are logged but do not abort the merge.
  const mergeGuestCartIntoServer = async (guestItems: ExtendedCartItem[]) => {
    setLoading(true);
    try {
      for (const item of guestItems) {
        const prod: any = item.product;
        const productId: string | undefined = prod?._id || prod?.id;
        if (!productId) continue;
        // Variant info is carried on the product object on guest items (see
        // optimistic-add path in `addToCart` below), so extract it the same
        // way that path packs it for authenticated users.
        const variation: string | undefined =
          prod?.variantTitle ||
          prod?.pack ||
          undefined;
        const variantId: string | undefined =
          prod?.variantId ||
          prod?.selectedVariant?._id ||
          undefined;
        const qty = Math.max(1, item.quantity || 1);
        try {
          await apiAddToCart(
            productId,
            qty,
            variation,
            location?.latitude,
            location?.longitude,
            variantId ? String(variantId) : undefined
          );
        } catch (err) {
          console.error("Guest cart merge: failed to push item", productId, err);
        }
      }
    } finally {
      // Always pull final merged state from the server, even if some pushes
      // failed — backend is the source of truth from here on.
      await fetchCart();
    }
  };

  const fetchFreeGiftRules = async () => {
    try {
      const res = await getCustomerFreeGiftRules();
      if (res.success && Array.isArray(res.data)) {
         const active = res.data
           .map(normalizeCartRewardRule)
           .filter((r) => r.status === 'Active')
           .sort((a, b) => a.minCartValue - b.minCartValue);
         setFreeGiftRules(active);
      }
    } catch (e) {
      console.error("Failed to fetch free gift rules", e);
    }
  };

  // Helper to map API items to state (Simplified for this context)
  const mapApiItemsToState = (apiItems: any[]): ExtendedCartItem[] => {
      return apiItems.map(item => ({
          id: item._id,
          product: {
              ...item.product,
              id: item.product._id,
              name: item.product.productName || item.product.name,
              imageUrl: item.product.mainImage || item.product.imageUrl,
              variantId: item.variantId || item.product?.selectedVariantId,
              variantTitle: item.variation,
              pack: item.variation || item.product?.pack,
              price:
                Number(item.unitPrice) > 0
                  ? item.unitPrice
                  : item.product?.price ?? item.product?.listing?.minPrice,
              discPrice:
                Number(item.unitPrice) > 0
                  ? item.unitPrice
                  : item.product?.discPrice ?? item.product?.price ?? item.product?.listing?.minPrice,
          },
          quantity: item.quantity,
          variant: item.variantId || item.variation,
          variantId: item.variantId,
          unitPrice: item.unitPrice,
          variation: item.variation,
          isFreeGift: item.isFreeGift || false
      }));
  };

  // Sync to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, user]);

  // Free Gift Logic (Multiple Gifts Support)
  useEffect(() => {
    const activeRules = getGiftRules(freeGiftRules);

    // Calculate total of PAID items
    const validItems = items.filter(item => item?.product);
    const paidItems = validItems.filter(i => !i.isFreeGift);
    const currentTotal = paidItems.reduce((sum, item) => {
       return sum + getCartLineUnitPrice(item) * (item.quantity || 0);
    }, 0);

    let newItems = [...items];
    let hasChanges = false;

    // 1. Remove gifts that are no longer valid (either rule inactive OR not met)
    const validGiftIds = new Set<string>(); // Product IDs of gifts we SHOULD have

    activeRules.forEach(rule => {
        if (currentTotal >= rule.minCartValue) {
            validGiftIds.add(String(rule.giftProductId));
        }
    });

    // Filter out gifts that shouldn't be there
    const itemsAfterRemoval = newItems.filter(item => {
        if (item.isFreeGift) {
            const prod = item.product;
            const productId = prod?.id || prod?._id || '';
            // Keep if it's in our valid set
            return validGiftIds.has(productId);
        }
        return true;
    });

    if (itemsAfterRemoval.length !== newItems.length) {
        newItems = itemsAfterRemoval;
        hasChanges = true;
    }

    // 2. Add gifts that are missing
    activeRules.forEach(rule => {
        if (currentTotal >= rule.minCartValue) {
            const giftProductId = String(rule.giftProductId || '');
            const giftProduct = rule.giftProduct;

            // Check if already present
            const exists = newItems.some(i => {
                const prod = i?.product;
                if (!prod || !i.isFreeGift) return false;
                const prodId = prod.id || prod._id;
                return prodId === giftProductId;
            });

            if (!exists && giftProduct) {
                const giftItem: ExtendedCartItem = {
                    id: `free-${giftProductId}-${Date.now()}-${Math.random()}`,
                    product: {
                        ...giftProduct,
                        price: 0,
                        discPrice: 0,
                        mrp: giftProduct.mrp || 0,
                    } as any,
                    quantity: 1,
                    isFreeGift: true
                };
                newItems.push(giftItem);
                hasChanges = true;
            }
        }
    });

    if (hasChanges) {
        setItems(newItems);
    }
    if (hasChanges) {
        setItems(newItems);
    }
  }, [items.map(i => {
      const p = i?.product;
      const pid = p?.id || p?._id || '';
      return `${pid}-${i.quantity}-${i.isFreeGift}`;
  }).join(','), freeGiftRules]);

  const cart: Cart = useMemo(() => {
    // Filter out any items with null products before computing totals
    const validItems = items.filter(item => item?.product);
    const total = validItems.reduce((sum, item) => {
      if (item.isFreeGift) return sum;
      return sum + getCartLineUnitPrice(item) * (item.quantity || 0);
    }, 0);
    const itemCount = validItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    return { items: validItems, total, itemCount };
  }, [items]);

  const addToCart = async (product: Product, sourceElement?: HTMLElement | null, options?: { source?: string, sourceId?: string }) => {
    // Get consistent product ID - MongoDB returns _id, frontend expects id
    const productId = product._id || product.id;

    // Prevent concurrent operations on the same product
    if (pendingOperationsRef.current.has(productId)) {
      return;
    }
    pendingOperationsRef.current.add(productId);

    // Normalize product to always have 'id' property for consistency
    const normalizedProduct: Product = {
      ...product,
      id: productId,
      name: product.name || product.productName || 'Product',
      imageUrl: product.imageUrl || product.mainImage,
    };

    // Optimistic Update
    // Get source position if element is provided
    let sourcePosition: { x: number; y: number } | undefined;
    if (sourceElement) {
      const rect = sourceElement.getBoundingClientRect();
      sourcePosition = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
    setLastAddEvent({ product: normalizedProduct, sourcePosition });
    setTimeout(() => setLastAddEvent(null), 800);

    // Optimistically update state
    setItems((prevItems) => {
      // Filter out null products and find existing item
      const validItems = prevItems.filter(item => item?.product);

      // Check for variant ID or variant title if product has variants
      const variantId = (product as any).variantId || (product as any).selectedVariant?._id;
      const variantTitle = (product as any).variantTitle || (product as any).pack;

      // Find existing item - match by product ID and variant (if variant exists)
      const existingItem = validItems.find((item) => {
        const prod = item.product;
        if (!prod) return false;
        const itemProductId = prod.id || prod._id;
        const itemVariantId = item.variantId || (prod as any).variantId || (prod as any).selectedVariant?._id;
        const itemVariantTitle = item.variation || (prod as any).variantTitle || (prod as any).pack;

        if (variantId || variantTitle) {
          return itemProductId === productId &&
                 (itemVariantId === variantId || itemVariantTitle === variantTitle);
        }
        return itemProductId === productId && !itemVariantId && !itemVariantTitle;
      });

      if (existingItem) {
        return validItems.map((item) => {
          const match = existingItem === item; // Simple ref check since we found it above
          const q = item.quantity || 0;

          return match
            ? { ...item, quantity: q + 1 }
            : item;
        });
      }
      return [...validItems, {
          product: normalizedProduct,
          quantity: 1,
          variant: variantId || variantTitle,
          variantId,
          variation: variantTitle,
          source: options?.source,
          sourceId: options?.sourceId
      }];
    });

    if (isAuthenticated && (user as any)?.userType === 'Customer') {
      try {
        const variation = (product as any).variantTitle || (product as any).pack;
        const response = await apiAddToCart(
          productId,
          1,
          variation,
          location?.latitude,
          location?.longitude,
          variantId ? String(variantId) : undefined
        );
        if (response && response.data && response.data.items) {
          setItems(mapApiItemsToState(response.data.items));
        }
      } catch (error) {
        console.error("Add to cart failed", error);
        // Error handling: if API fails, we could potentially rollback or stay optimistic
      } finally {
        pendingOperationsRef.current.delete(productId);
      }
    } else {
      pendingOperationsRef.current.delete(productId);
    }
  };

  const removeFromCart = async (productId: string) => {
    // Prevent concurrent operations on the same product
    if (pendingOperationsRef.current.has(productId)) {
      return;
    }
    pendingOperationsRef.current.add(productId);

    // Find item matching either id or _id
    const itemToRemove = items.find(item => {
        const prod = item?.product;
        if (!prod) return false;
        const prodId = prod.id || prod._id;
        return prodId === productId;
    });

    const previousItems = [...items];
    setItems((prevItems) => prevItems.filter((item) => {
        const prod = item?.product;
        if (!prod) return false; // Filter out bad data
        const prodId = prod.id || prod._id;
        return prodId !== productId;
    }));

    if (isAuthenticated && (user as any)?.userType === 'Customer' && itemToRemove?.id) {
      try {
        const response = await apiRemoveFromCart(
          itemToRemove.id,
          location?.latitude,
          location?.longitude
        );
        if (response && response.data && response.data.items) {
          setItems(mapApiItemsToState(response.data.items));
        }
      } catch (error) {
        console.error("Remove from cart failed", error);
        setItems(previousItems);
      } finally {
        pendingOperationsRef.current.delete(productId);
      }
    } else {
      pendingOperationsRef.current.delete(productId);
    }
  };

  const updateQuantity = async (productId: string, quantity: number, variantId?: string, variantTitle?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    // Create a unique operation key for this product/variant combination
    const operationKey = variantId ? `${productId}-${variantId}` : (variantTitle ? `${productId}-${variantTitle}` : productId);

    // Prevent concurrent operations on the same product
    if (pendingOperationsRef.current.has(operationKey)) {
      return;
    }
    pendingOperationsRef.current.add(operationKey);

    // Find item matching product ID and variant (if variant info provided)
    const itemToUpdate = items.find(item => {
      const prod = item?.product;
      if (!prod) return false;
      const itemProductId = prod.id || prod._id;
      if (itemProductId !== productId) return false;

      // If variant info provided, match by variant
      if (variantId || variantTitle) {
        const itemVariantId = item.variantId || (prod as any).variantId || (prod as any).selectedVariant?._id;
        const itemVariantTitle = item.variation || (prod as any).variantTitle || (prod as any).pack;
        return itemVariantId === variantId || itemVariantTitle === variantTitle;
      }

      // If no variant info, match items without variants
      const itemVariantId = item.variantId || (prod as any).variantId || (prod as any).selectedVariant?._id;
      const itemVariantTitle = item.variation || (prod as any).variantTitle;
      return !itemVariantId && !itemVariantTitle;
    });

    const previousItems = [...items];
    setItems((prevItems) =>
      prevItems
        .filter(item => !!item?.product)
        .map((item) => {
          const prod = item.product!;
        const itemProductId = prod.id || prod._id;
        if (itemProductId !== productId) return item;

        // If variant info provided, match by variant
        if (variantId || variantTitle) {
          const itemVariantId = item.variantId || (prod as any).variantId || (prod as any).selectedVariant?._id;
          const itemVariantTitle = item.variation || (prod as any).variantTitle || (prod as any).pack;
          if (itemVariantId === variantId || itemVariantTitle === variantTitle) {
            return { ...item, quantity };
          }
        } else {
          // If no variant info, match items without variants
          const itemVariantId = item.variantId || (prod as any).variantId || (prod as any).selectedVariant?._id;
          const itemVariantTitle = item.variation || (prod as any).variantTitle;
          if (!itemVariantId && !itemVariantTitle) {
            return { ...item, quantity };
          }
        }
        return item;
      })
    );

    if (isAuthenticated && (user as any)?.userType === 'Customer' && itemToUpdate?.id) {
      try {
        const response = await apiUpdateCartItem(
          itemToUpdate.id,
          quantity,
          location?.latitude,
          location?.longitude
        );
        if (response && response.data && response.data.items) {
          setItems(mapApiItemsToState(response.data.items));
        }
      } catch (error) {
        console.error("Update quantity failed", error);
        setItems(previousItems);
      } finally {
        pendingOperationsRef.current.delete(operationKey);
      }
    } else {
      pendingOperationsRef.current.delete(operationKey);
    }
  };


  const clearCart = async () => {
    setItems([]);
    if (isAuthenticated && (user as any)?.userType === 'Customer') {
      try {
        await apiClearCart();
      } catch (error) {
        console.error("Clear cart failed", error);
        fetchCart();
      }
    }
  };

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, lastAddEvent, loading, freeGiftRules }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}


