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
import { calculateProductPrice, getApplicableUnitPrice } from '../utils/priceUtils';
import { getCustomerFreeGiftRules } from '../services/api/customerFreeGiftService';
import { FreeGiftRule } from '../hooks/useFreeGiftRules';

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
  freeGiftRules: FreeGiftRule[];
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
  const [freeGiftRules, setFreeGiftRules] = useState<FreeGiftRule[]>([]);
  const pendingOperationsRef = useRef<Set<string>>(new Set());

  const { isAuthenticated, user } = useAuth();
  const { location } = useLocation();

  useEffect(() => {
    setLoading(false);
    fetchFreeGiftRules();
  }, []);

  const fetchFreeGiftRules = async () => {
    try {
      const res = await getCustomerFreeGiftRules();
      if (res.success && Array.isArray(res.data)) {
         const active = res.data
           .filter((r: any) => r.status === 'Active')
           .sort((a: any, b: any) => a.minCartValue - b.minCartValue);
         setFreeGiftRules(active);
      }
    } catch (e) {
      console.error("Failed to fetch free gift rules", e);
    }
  };

  // Helper to map API items to state (Simplified for this context)
  const mapApiItemsToState = (apiItems: any[]): ExtendedCartItem[] => {
      //... existing map logic if needed, or leave strictly local for now as per "FrontEnd Only Mode" comment
      // For now, preservation of source in API sync is out of scope as API Sync is disabled in code
      return [];
  };

  // Sync to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Free Gift Logic (Multiple Gifts Support)
  useEffect(() => {
    const activeRules = freeGiftRules; // Uses state now

    // Calculate total of PAID items
    const validItems = items.filter(item => item?.product);
    const paidItems = validItems.filter(i => !i.isFreeGift);
    const currentTotal = paidItems.reduce((sum, item) => {
       const unitPrice = getApplicableUnitPrice(item.product, item.variant, item.quantity || 0);
       return sum + unitPrice * (item.quantity || 0);
    }, 0);

    let newItems = [...items];
    let hasChanges = false;

    // 1. Remove gifts that are no longer valid (either rule inactive OR not met)
    const validGiftIds = new Set<string>(); // Product IDs of gifts we SHOULD have

    activeRules.forEach(rule => {
        if (currentTotal >= rule.minCartValue) {
            validGiftIds.add(rule.giftProductId);
        }
    });

    // Filter out gifts that shouldn't be there
    const itemsAfterRemoval = newItems.filter(item => {
        if (item.isFreeGift) {
            const productId = item.product.id || item.product._id || '';
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
            const giftProductId = rule.giftProductId;
            const giftProduct = rule.giftProduct;

            // Check if already present
            const exists = newItems.some(i => i.isFreeGift && (i.product.id === giftProductId || i.product._id === giftProductId));

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
  }, [items.map(i => `${i.product.id}-${i.quantity}-${i.isFreeGift}`).join(','), freeGiftRules]);

  const cart: Cart = useMemo(() => {
    // Filter out any items with null products before computing totals
    const validItems = items.filter(item => item?.product);
    const total = validItems.reduce((sum, item) => {
      if (item.isFreeGift) return sum;
      const unitPrice = getApplicableUnitPrice(item.product, item.variant, item.quantity || 0);
      return sum + unitPrice * (item.quantity || 0);
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
        const itemProductId = item.product.id || item.product._id;
        const itemVariantId = (item.product as any).variantId || (item.product as any).selectedVariant?._id;
        const itemVariantTitle = (item.product as any).variantTitle || (item.product as any).pack;

        // If both have variants, match by variant ID or title
        if (variantId || variantTitle) {
          return itemProductId === productId &&
                 (itemVariantId === variantId || itemVariantTitle === variantTitle);
        }
        // If no variant, match by product ID only
        return itemProductId === productId && !itemVariantId && !itemVariantTitle;
      });

      if (existingItem) {
        return validItems.map((item) => {
          const itemProductId = item.product.id || item.product._id;
          const match = existingItem === item; // Simple ref check since we found it above

          return match
            ? { ...item, quantity: item.quantity + 1 }
            : item;
        });
      }
      return [...validItems, {
          product: normalizedProduct,
          quantity: 1,
          source: options?.source,
          sourceId: options?.sourceId
      }];
    });

    // API SYNC DISABLED FOR FRONTEND ONLY MODE
    pendingOperationsRef.current.delete(productId);

    // if (isAuthenticated && user?.userType === 'Customer') {
    //   try {
    //     const variation = (product as any).variantId || (product as any).selectedVariant?._id || (product as any).variantTitle || (product as any).pack;
    //     const response = await apiAddToCart(
    //       productId,
    //       1,
    //       variation,
    //       location?.latitude,
    //       location?.longitude
    //     );
    //     if (response && response.data && response.data.items) {
    //       setItems(mapApiItemsToState(response.data.items));
    //     }
    //   } catch (error) {
    //     console.error("Add to cart failed", error);
    //     setItems(previousItems);
    //   } finally {
    //     pendingOperationsRef.current.delete(productId);
    //   }
    // } else {
    //   pendingOperationsRef.current.delete(productId);
    // }
  };

  const removeFromCart = async (productId: string) => {
    // Prevent concurrent operations on the same product
    if (pendingOperationsRef.current.has(productId)) {
      return;
    }
    pendingOperationsRef.current.add(productId);

    // Find item matching either id or _id
    const itemToRemove = items.find(item => item?.product && (item.product.id === productId || item.product._id === productId));

    const previousItems = [...items];
    setItems((prevItems) => prevItems.filter((item) => item?.product && item.product.id !== productId && item.product._id !== productId));

    // API SYNC DISABLED FOR FRONTEND ONLY MODE
    pendingOperationsRef.current.delete(productId);

    // if (isAuthenticated && user?.userType === 'Customer' && itemToRemove?.id) {
    //   try {
    //     const response = await apiRemoveFromCart(
    //       itemToRemove.id,
    //       location?.latitude,
    //       location?.longitude
    //     );
    //     if (response && response.data && response.data.items) {
    //       setItems(mapApiItemsToState(response.data.items));
    //     }
    //   } catch (error) {
    //     console.error("Remove from cart failed", error);
    //     setItems(previousItems);
    //   } finally {
    //     pendingOperationsRef.current.delete(productId);
    //   }
    // } else {
    //   pendingOperationsRef.current.delete(productId);
    // }
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
      if (!item?.product) return false;
      const itemProductId = item.product.id || item.product._id;
      if (itemProductId !== productId) return false;

      // If variant info provided, match by variant
      if (variantId || variantTitle) {
        const itemVariantId = (item.product as any).variantId || (item.product as any).selectedVariant?._id;
        const itemVariantTitle = (item.product as any).variantTitle || (item.product as any).pack;
        return itemVariantId === variantId || itemVariantTitle === variantTitle;
      }

      // If no variant info, match items without variants
      const itemVariantId = (item.product as any).variantId || (item.product as any).selectedVariant?._id;
      const itemVariantTitle = (item.product as any).variantTitle;
      return !itemVariantId && !itemVariantTitle;
    });

    const previousItems = [...items];
    setItems((prevItems) =>
      prevItems.filter(item => item?.product).map((item) => {
        const itemProductId = item.product.id || item.product._id;
        if (itemProductId !== productId) return item;

        // If variant info provided, match by variant
        if (variantId || variantTitle) {
          const itemVariantId = (item.product as any).variantId || (item.product as any).selectedVariant?._id;
          const itemVariantTitle = (item.product as any).variantTitle || (item.product as any).pack;
          if (itemVariantId === variantId || itemVariantTitle === variantTitle) {
            return { ...item, quantity };
          }
        } else {
          // If no variant info, match items without variants
          const itemVariantId = (item.product as any).variantId || (item.product as any).selectedVariant?._id;
          const itemVariantTitle = (item.product as any).variantTitle;
          if (!itemVariantId && !itemVariantTitle) {
            return { ...item, quantity };
          }
        }
        return item;
      })
    );

    // API SYNC DISABLED FOR FRONTEND ONLY MODE
    pendingOperationsRef.current.delete(operationKey);

    // if (isAuthenticated && user?.userType === 'Customer' && itemToUpdate?.id) {
    //   try {
    //     const response = await apiUpdateCartItem(
    //       itemToUpdate.id,
    //       quantity,
    //       location?.latitude,
    //       location?.longitude
    //     );
    //     if (response && response.data && response.data.items) {
    //       setItems(mapApiItemsToState(response.data.items));
    //     }
    //   } catch (error) {
    //     console.error("Update quantity failed", error);
    //     setItems(previousItems);
    //   } finally {
    //     pendingOperationsRef.current.delete(operationKey);
    //   }
    // } else {
    //   pendingOperationsRef.current.delete(operationKey);
    // }
  };


  const clearCart = async () => {
    setItems([]);
    // try {
    //   await apiClearCart();
    // } catch (error) {
    //   console.error("Clear cart failed", error);
    //   await fetchCart();
    // }
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


