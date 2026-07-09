import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import { Product } from '../../../types/domain';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { useLocation } from '../../../hooks/useLocation';
import { useToast } from '../../../context/ToastContext'; // Import useToast
import { addToWishlist, removeFromWishlist, getWishlist } from '../../../services/api/customerWishlistService';
import Button from '../../../components/ui/button';
import Badge from '../../../components/ui/badge';
import StarRating from '../../../components/ui/StarRating';
import { calculateCardPrice, getApplicableUnitPrice } from '../../../utils/priceUtils';
import {
  buildProductWithPrimaryVariant,
  findCartItemForPrimaryVariant,
  getPrimaryVariant,
  getProductCardImage,
  getVariantId,
  getVariantLabel,
  getVariants,
  hasRealVariants,
} from '../../../utils/customerVariantUtils';
import { useThemeContext } from '../../../context/ThemeContext';

interface ProductCardProps {
  product: Product;
  showBadge?: boolean;
  badgeText?: string;
  showPackBadge?: boolean;
  showStockInfo?: boolean;
  showHeartIcon?: boolean;
  showRating?: boolean;
  showVegetarianIcon?: boolean;
  showOptionsText?: boolean;
  optionsCount?: number;
  compact?: boolean;
  categoryStyle?: boolean;
}

export default function ProductCard({
  product,
  showBadge = false,
  badgeText,
  showPackBadge = false,
  showStockInfo = false,
  showHeartIcon = false,
  showRating = false,
  showVegetarianIcon = false,
  showOptionsText = false,
  optionsCount = 2,
  compact = false,
  categoryStyle = false,
}: ProductCardProps) {
  const navigate = useNavigate();
  const { cart, addToCart, updateQuantity } = useCart();
  const { isAuthenticated } = useAuth();
  const { location } = useLocation();
  const { showToast } = useToast(); // Get toast function
  const imageRef = useRef<HTMLImageElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  // Single ref to track any cart operation in progress for this product
  const isOperationPendingRef = useRef(false);

  useEffect(() => {
    if (!showHeartIcon) return;
    // Only check wishlist if user is authenticated
    if (!isAuthenticated) {
      setIsWishlisted(false);
      return;
    }

    const checkWishlist = async () => {
      try {
        const res = await getWishlist({
          latitude: location?.latitude,
          longitude: location?.longitude
        });
        if (res.success && res.data && res.data.products) {
          const targetId = String((product as any).id || product._id);
          const exists = res.data.products.some(p => String(p._id || (p as any).id) === targetId);
          setIsWishlisted(exists);
        }
      } catch (e) {
        // Silently fail if not logged in
        setIsWishlisted(false);
      }
    };
    checkWishlist();
  }, [product.id, product._id, isAuthenticated, location?.latitude, location?.longitude, showHeartIcon]);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const targetId = String((product as any).id || product._id);
    const previousState = isWishlisted;

    try {
      if (isWishlisted) {
        // Optimistic update
        setIsWishlisted(false);
        await removeFromWishlist(targetId);
        showToast('Removed from wishlist');
      } else {
        if (!location?.latitude || !location?.longitude) {
           showToast('Location is required to add items to wishlist', 'error');
           return;
        }
        // Optimistic update
        setIsWishlisted(true);
        await addToWishlist(
          targetId,
          location?.latitude,
          location?.longitude
        );
        showToast('Added to wishlist');
      }
    } catch (e: any) {
      console.error('Failed to toggle wishlist:', e);
      setIsWishlisted(previousState);
      const errorMessage = e.response?.data?.message || e.message || 'Failed to update wishlist';
      showToast(errorMessage, 'error');
    }
  };

  const primaryVariant = getPrimaryVariant(product);
  const primaryVariantId = getVariantId(primaryVariant);
  const primaryVariantLabel = getVariantLabel(primaryVariant) || product.pack;
  const variantCount = getVariants(product).length;
  const cardImageUrl = getProductCardImage(product);

  const cartItem = findCartItemForPrimaryVariant(cart.items, product);
  const inCartQty = cartItem?.quantity || 0;

  // Get Price and MRP using primary variant (first created) with legacy fallbacks
  const { displayPrice, mrp, discount } = calculateCardPrice(product);

  // Get real tiered pricing from root or first variation, ignoring zero-priced default tiers
  const tieredPrices = (((product as any).unitPricing && (product as any).unitPricing.length > 0)
      ? (product as any).unitPricing
      : (primaryVariant?.tieredPrices || [])
  ).filter((t: any) => t && Number(t.price) > 0);

  const variationSelector = hasRealVariants(product) ? 0 : undefined;
  // Calculate dynamic unit price based on cart quantity
  const currentUnitPrice = getApplicableUnitPrice(product, variationSelector, Math.max(1, inCartQty));

  const deliveryTimeText = (() => {
    const raw = (product as any)?.deliveryTime;
    const text = raw === undefined || raw === null ? '' : String(raw).trim();
    if (!text) return '14 MINS';
    if (/^\d+(\.\d+)?$/.test(text)) return `${text} MINS`;
    return text;
  })();

  const handleCardClick = () => {
    const mainElement = document.querySelector('main');
    const currentHistoryState = window.history.state || {};
    const existingUserState = currentHistoryState.usr || {};
    const pageKey = `${window.location.pathname}${window.location.search}`;

    window.history.replaceState(
      {
        ...currentHistoryState,
        usr: {
          ...existingUserState,
          scrollRestore: {
            source: 'product-card',
            pageKey,
            productId: (product as any).id || product._id,
            mainTop: mainElement instanceof HTMLElement ? mainElement.scrollTop : 0,
            windowTop: window.scrollY || window.pageYOffset || 0,
            preferredTarget:
              (window.scrollY || window.pageYOffset || 0) >
              (mainElement instanceof HTMLElement ? mainElement.scrollTop : 0)
                ? 'window'
                : 'main',
          },
        },
      },
      '',
      window.location.href
    );

    navigate(`/product/${((product as any).id || product._id) as string}`);
  };

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Check if product is available in user's location
    if (product.isAvailable === false) {
      return;
    }

    // Prevent any operation while another is in progress
    if (isOperationPendingRef.current) {
      return;
    }

    isOperationPendingRef.current = true;

    try {
      await addToCart(buildProductWithPrimaryVariant(product), addButtonRef.current);
    } finally {
      // Reset the flag after the operation truly completes
      isOperationPendingRef.current = false;
    }
  };

  const handleDecrease = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Prevent any operation while another is in progress
    if (isOperationPendingRef.current || inCartQty <= 0) {
      return;
    }

    isOperationPendingRef.current = true;

    try {
      await updateQuantity(
        ((product as any).id || product._id) as string,
        inCartQty - 1,
        primaryVariantId,
        primaryVariantLabel
      );
    } finally {
      // Reset the flag after the operation truly completes
      isOperationPendingRef.current = false;
    }
  };

  const handleIncrease = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Check if product is available in user's location
    if (product.isAvailable === false) {
      return;
    }

    // Prevent any operation while another is in progress
    if (isOperationPendingRef.current) {
      return;
    }

    isOperationPendingRef.current = true;

    try {
      if (inCartQty > 0) {
        await updateQuantity(
          ((product as any).id || product._id) as string,
          inCartQty + 1,
          primaryVariantId,
          primaryVariantLabel
        );
      } else {
        await addToCart(buildProductWithPrimaryVariant(product), addButtonRef.current);
      }
    } finally {
      // Reset the flag after the operation truly completes
      isOperationPendingRef.current = false;
    }
  };

  const { currentTheme: theme, currentCategory } = useThemeContext();

  return (
    <motion.div
      id={`product-${(product as any).id || product._id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={`${categoryStyle ? '' : 'bg-white'} rounded-lg shadow-sm overflow-hidden flex flex-col relative border border-neutral-100 hover:shadow-md transition-shadow`}
      style={{ backgroundColor: '#ffffff' }} // Changed from orange tint to white
    >
      <div
        onClick={handleCardClick}
        className="cursor-pointer flex-1 flex flex-col"
      >
        <div className={`w-full ${compact ? 'h-48 md:h-56' : categoryStyle ? 'h-56 md:h-64' : 'h-64 md:h-80'} bg-neutral-100 flex items-center justify-center overflow-hidden relative`}>
          {cardImageUrl ? (
            <img
              ref={imageRef}
              src={cardImageUrl}
              alt={product.name || product.productName || 'Product'}
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Hide broken image and show fallback
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.fallback-icon')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl fallback-icon';
                  fallback.textContent = (product.name || product.productName || '?').charAt(0).toUpperCase();
                  parent.appendChild(fallback);
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl">
              {(product.name || product.productName || '?').charAt(0).toUpperCase()}
            </div>
          )}

          {categoryStyle && showBadge && discount > 0 && (
            <div
                className="absolute top-0 left-0 z-10 text-white text-[10px] font-bold px-2 py-1 rounded-br-lg flex items-center gap-1 shadow-sm transition-transform hover:scale-105"
                style={{ background: 'linear-gradient(135deg, var(--customer-primary) 0%, var(--customer-primary-dark) 100%)' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
              <span>{discount}% OFF</span>
            </div>
          )}

          {!categoryStyle && showBadge && (badgeText || discount > 0) && (
            <div
              className="absolute top-0 left-0 z-10 text-white text-[10px] px-2.5 py-1 font-bold rounded-br-xl shadow-md flex items-center gap-1"
              style={{ background: 'linear-gradient(135deg, var(--customer-primary) 0%, var(--customer-primary-dark) 100%)' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
              <span>{badgeText || `${discount}% OFF`}</span>
            </div>
          )}

          {showPackBadge && (
            <Badge
              variant="outline"
              className="absolute top-2 right-2 z-10 text-xs px-2 py-1 font-medium"
            >
              {primaryVariantLabel || product.pack}
            </Badge>
          )}

          {showHeartIcon && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWishlist(e);
              }}
              className="absolute top-2 right-2 z-30 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all shadow-md group/heart"
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill={isWishlisted ? "var(--customer-primary)" : "none"}
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-colors ${isWishlisted ? "text-[var(--customer-primary)]" : "text-neutral-400 group-hover/heart:text-red-400"}`}
              >
                <path
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {variantCount >= 2 && (
            <div className="absolute bottom-2 left-2 z-10">
              <span className="text-[10px] font-bold text-neutral-700 bg-white/95 backdrop-blur-sm px-2 py-1 rounded shadow-sm border border-neutral-200">
                {variantCount} Options
              </span>
            </div>
          )}
        </div>

        {categoryStyle && (
          <div className="px-2.5 pt-1.5 pb-0">
            {inCartQty === 0 ? (
              <div className="flex flex-col items-center w-full">
                <div className="flex justify-center w-full">
                  <Button
                    ref={addButtonRef}
                    variant="default"
                    size="sm"
                    disabled={product.isAvailable === false}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd(e);
                    }}
                    className={`w-full rounded-full font-bold text-[11px] h-8 px-4 flex items-center justify-center gap-1.5 uppercase tracking-wider transition-all duration-300 border shadow-sm ${
                      product.isAvailable === false
                      ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
                      : 'hover:bg-[var(--customer-primary-dark)] hover:text-white hover:border-[var(--customer-primary-dark)] hover:shadow-md active:scale-95'
                    }`}
                    style={product.isAvailable !== false ? {
                        backgroundColor: 'var(--customer-primary-alpha-10)',
                        borderColor: 'var(--customer-primary)',
                        color: 'var(--customer-primary)'
                    } : {}}
                  >
                    {product.isAvailable === false ? (
                       'Out of Range'
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        <span>ADD</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center justify-center gap-1.5 bg-[var(--customer-primary-alpha-10)] rounded-full px-1 py-0.5 h-8 w-full border border-[var(--customer-primary-alpha-30)] shadow-sm"
              >
                <Button
                  variant="default"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDecrease(e);
                  }}
                  className="w-6 h-6 p-0 bg-white hover:bg-[var(--customer-primary-alpha-20)] rounded-full shadow-sm text-[var(--customer-primary-dark)] transition-colors border border-[var(--customer-primary-alpha-20)]"
                  aria-label="Decrease quantity"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </Button>
                <span className="text-xs font-black min-w-[1.25rem] text-center text-[var(--customer-primary-dark)]">
                  {inCartQty}
                </span>
                <Button
                  variant="default"
                  size="icon"
                  disabled={product.isAvailable === false}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIncrease(e);
                  }}
                  className={`w-6 h-6 p-0 bg-white hover:bg-[var(--customer-primary-alpha-20)] rounded-full shadow-sm text-[var(--customer-primary-dark)] transition-colors border border-[var(--customer-primary-alpha-20)] ${
                    product.isAvailable === false ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  aria-label="Increase quantity"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </Button>
              </div>
            )}
          </div>
        )}

        <div className={`${compact ? 'p-3 md:p-4' : categoryStyle ? 'px-2.5 md:px-3 pt-1.5 md:pt-2 pb-2 md:pb-3' : 'p-4 md:p-5'} flex-1 flex flex-col`}>
          {categoryStyle ? (
            // Category Style Layout: Quantity, Name, Time, % off, Price
            <>
              {/* 1. Quantity */}
              {!showPackBadge && (product.pack || primaryVariantLabel) && (
                <p className="text-[10px] text-neutral-500 mb-0.5 leading-tight font-medium">
                  {primaryVariantLabel || product.pack}
                </p>
              )}

              {/* 2. Name */}
              <h3 className="text-xs md:text-sm font-bold text-neutral-900 mb-0.5 line-clamp-2 leading-tight overflow-hidden">
                {product.name || product.productName || ''}
              </h3>

              {/* 2.5. Rating - Only show if rating exists */}
              {((product.rating || (product as any).rating) || 0) > 0 && (
                <div className="mb-0">
                  <StarRating
                    rating={(product.rating || (product as any).rating) || 0}
                    reviewCount={(product.reviews || (product as any).reviewsCount) || 0}
                    size="sm"
                    showCount={true}
                  />
                </div>
              )}

              {/* 3. Time */}
               <p className="text-[10px] text-neutral-500 mb-0.5 flex items-center gap-0.5 leading-tight">
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                   <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                   <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                 </svg>
                 <span>{deliveryTimeText}</span>
               </p>

              {/* 4. Tiered Pricing Static Display (Multi-Row) */}
              {tieredPrices.length > 0 ? (
                 <div className="flex flex-col gap-0 mb-1 mt-auto w-full border-t border-gray-100 pt-1">
                    {/* Line 1: Base Price */}
                    <div className="flex justify-between items-center text-[10px] leading-none py-0.5">
                       <span className="text-gray-500 font-medium">1 unit</span>
                       <div className="flex items-center gap-1">
                         <span className="font-semibold text-[var(--customer-primary-dark)]">₹{displayPrice}</span>
                       </div>
                    </div>
                    {/* Additional Tiers */}
                    {tieredPrices.slice().sort((a: any, b: any) => a.minQty - b.minQty).map((tier: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] leading-none py-0.5">
                           <span className="text-[var(--customer-primary)] font-bold">{tier.minQty}+ units</span>
                           <div className="flex items-center gap-1">
                             <span className="font-bold text-[var(--customer-primary-dark)]">₹{tier.price}</span>
                              <span className="text-[var(--customer-primary)] font-bold bg-[var(--customer-primary-alpha-10)] px-1 rounded-sm">
                               {Math.round(((mrp - tier.price) / mrp) * 100)}% OFF
                             </span>
                           </div>
                        </div>
                    ))}
                 </div>
              ) : (
                 discount > 0 && (
                   <p className="text-[10px] font-semibold text-[var(--customer-primary)] mb-0.5 leading-tight">
                    {discount}% OFF
                  </p>
                 )
              )}

              {/* 5. Price with discount */}
              <div className="mt-auto pt-0.5">
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className="text-sm md:text-base font-bold text-[var(--customer-primary)] leading-tight">
                    ₹{currentUnitPrice.toLocaleString('en-IN')}
                  </span>
                  {mrp && mrp > displayPrice && (
                    <span className="text-[10px] text-red-400 line-through leading-tight">
                      ₹{mrp.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            // Non-category style layout (original)
            <>
              {!showPackBadge && (
                <p className={`${compact ? 'text-[10px] md:text-xs' : 'text-xs md:text-sm'} text-neutral-500 mb-1`}>
                    {primaryVariantLabel || product.pack}
                </p>
              )}

              <h3 className={`${compact ? 'text-xs md:text-sm' : 'text-sm md:text-base'} font-semibold text-neutral-900 ${compact ? 'mb-1' : 'mb-2'} line-clamp-2 ${compact ? 'min-h-[2rem]' : 'min-h-[2.5rem]'}`}>
                {product.name || product.productName || ''}
              </h3>

              {/* Always show rating */}
              <div className={`${compact ? 'mb-1' : 'mb-2'}`}>
                <StarRating
                  rating={(product.rating || (product as any).rating) || 0}
                  reviewCount={(product.reviews || (product as any).reviewsCount) || 0}
                  size={compact ? 'sm' : 'md'}
                  showCount={true}
                />
              </div>

              {/* Tiered Pricing Display */}
              {tieredPrices.length > 0 && (
                  <div className="mb-2 space-y-1">
                      {/* Base Price Tier */}
                      <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded text-[10px]">
                          <span className="font-medium text-gray-600">Buy 1</span>
                          <div className="flex items-center gap-1">
                              <span className="font-bold text-[var(--customer-primary-dark)]">₹{displayPrice}</span>
                          </div>
                      </div>
                      {/* Additional Tiers */}
                      {tieredPrices.map((tier: any, idx: number) => {
                          const tierDiscount = mrp ? Math.round(((mrp - tier.price) / mrp) * 100) : 0;
                          return (
                               <div key={idx} className="flex justify-between items-center bg-[var(--customer-primary-alpha-10)] px-2 py-1 rounded text-[10px] border border-[var(--customer-primary-alpha-20)]">
                                  <span className="font-bold text-red-800">Buy {tier.minQty}+</span>
                                  <div className="flex items-center gap-1">
                                      <span className="font-bold text-red-700">₹{tier.price}</span>
                                      {tierDiscount > 0 && <span className="text-[9px] text-[var(--customer-primary)] font-bold">({tierDiscount}% OFF)</span>}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}

              {showStockInfo && (
                <p className="text-xs text-[var(--customer-primary)] mb-2 font-medium">
                  Fast delivery
                </p>
              )}

              {showVegetarianIcon && (
                <div className="flex items-center gap-1 mb-2">
                  <div className="w-4 h-4 bg-[var(--customer-primary)] rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span className="text-xs text-neutral-600">Vegetarian</span>
                </div>
              )}

              <div className="mt-auto mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-base font-bold text-[var(--customer-primary)]">
                    ₹{displayPrice}
                  </span>
                  {mrp && mrp > displayPrice && (
                    <span className="text-xs text-red-400 line-through">
                      ₹{mrp}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {!categoryStyle && (
        <div className={`${compact ? 'px-3 pb-3' : 'px-4 pb-4'}`}>
          <div className="mt-auto">
            {inCartQty === 0 ? (
              <div>
                <Button
                  ref={addButtonRef}
                  variant="default"
                  size="sm"
                  disabled={product.isAvailable === false}
                  onClick={handleAdd}
                  className={`w-full border h-9 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300 shadow-sm ${
                    product.isAvailable === false
                    ? 'border-neutral-200 text-neutral-400 bg-neutral-50 cursor-not-allowed'
                    : 'hover:bg-[var(--customer-primary-dark)] hover:text-white hover:border-[var(--customer-primary-dark)] hover:shadow-md active:scale-95'
                  }`}
                  style={product.isAvailable !== false ? {
                      backgroundColor: 'var(--customer-primary-alpha-10)',
                      borderColor: 'var(--customer-primary)',
                      color: 'var(--customer-primary)'
                  } : {}}
                >
                  {product.isAvailable === false ? (
                    'Out of Range'
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      <span>ADD</span>
                    </div>
                  )}
                </Button>
                <div className="h-4 mt-1">
                </div>
              </div>
            ) : (
              <div
                className="flex items-center justify-center gap-2 bg-[var(--customer-primary-alpha-10)] rounded-full px-2 py-1 h-9 border border-[var(--customer-primary-alpha-30)] shadow-sm"
              >
                <Button
                  variant="default"
                  size="icon"
                  onClick={handleDecrease}
                  className="w-7 h-7 p-0 bg-white hover:bg-[var(--customer-primary-alpha-20)] rounded-full shadow-sm text-[var(--customer-primary-dark)] transition-colors border border-[var(--customer-primary-alpha-20)]"
                  aria-label="Decrease quantity"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </Button>
                <span className="text-xs font-black min-w-[1.5rem] text-center text-[var(--customer-primary-dark)]">
                  {inCartQty}
                </span>
                <Button
                  variant="default"
                  size="icon"
                  disabled={product.isAvailable === false}
                  onClick={handleIncrease}
                  className={`w-7 h-7 p-0 bg-white hover:bg-[var(--customer-primary-alpha-20)] rounded-full shadow-sm text-[var(--customer-primary-dark)] transition-colors border border-[var(--customer-primary-alpha-20)] ${
                    product.isAvailable === false ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  aria-label="Increase quantity"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
