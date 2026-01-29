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
import { calculateProductPrice, getApplicableUnitPrice } from '../../../utils/priceUtils';

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
  }, [product.id, product._id, isAuthenticated, location?.latitude, location?.longitude]);

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

  const cartItem = cart.items.find((item) => item?.product && (item.product.id === (product as any).id || item.product._id === (product as any).id || item.product.id === product._id));
  const inCartQty = cartItem?.quantity || 0;

  // Get Price and MRP using utility
  const { displayPrice, mrp, discount } = calculateProductPrice(product);

  // Get real tiered pricing from root or first variation
  const tieredPrices = ((product as any).unitPricing && (product as any).unitPricing.length > 0)
      ? (product as any).unitPricing
      : (product.variations?.[0]?.tieredPrices || []);

  // Calculate dynamic unit price based on cart quantity
  let currentUnitPrice = getApplicableUnitPrice(product, undefined, Math.max(1, inCartQty));

  const handleCardClick = () => {
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
      await addToCart(product, addButtonRef.current);
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
      await updateQuantity(((product as any).id || product._id) as string, inCartQty - 1);
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
        await updateQuantity(((product as any).id || product._id) as string, inCartQty + 1);
      } else {
        await addToCart(product, addButtonRef.current);
      }
    } finally {
      // Reset the flag after the operation truly completes
      isOperationPendingRef.current = false;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={`${categoryStyle ? 'bg-green-50' : 'bg-white'} rounded-lg shadow-sm overflow-hidden flex flex-col relative`}
    >
      <div
        onClick={handleCardClick}
        className="cursor-pointer flex-1 flex flex-col"
      >
        <div className={`w-full ${compact ? 'h-32 md:h-40' : categoryStyle ? 'h-28 md:h-36' : 'h-40 md:h-48'} bg-neutral-100 flex items-center justify-center overflow-hidden relative`}>
          {product.imageUrl || product.mainImage ? (
            <img
              ref={imageRef}
              src={product.imageUrl || product.mainImage}
              alt={product.name || product.productName || 'Product'}
              className="w-full h-full object-cover"
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
            <div className="absolute top-2 left-2 z-10 bg-green-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
              {discount}% off
            </div>
          )}

          {!categoryStyle && showBadge && (badgeText || discount > 0) && (
            <Badge
              variant="destructive"
              className="absolute top-2 left-2 z-10 text-xs px-2 py-1"
            >
              {badgeText || `${discount}% OFF`}
            </Badge>
          )}

          {showPackBadge && (
            <Badge
              variant="outline"
              className="absolute top-2 right-2 z-10 text-xs px-2 py-1 font-medium"
            >
              {product.variations?.[0]?.value || product.pack}
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
                fill={isWishlisted ? "#ef4444" : "none"}
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-colors ${isWishlisted ? "text-red-500" : "text-neutral-400 group-hover/heart:text-red-400"}`}
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

          {(product.variations?.length || 0) >= 2 && (
            <div className="absolute bottom-2 left-2 z-10">
              <span className="text-[10px] font-bold text-neutral-700 bg-white/95 backdrop-blur-sm px-2 py-1 rounded shadow-sm border border-neutral-200">
                {product.variations?.length} Options
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
                    variant="outline"
                    size="sm"
                    disabled={product.isAvailable === false}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd(e);
                    }}
                    className={`w-full border rounded-full font-semibold text-xs h-7 px-3 flex items-center justify-center uppercase tracking-wide ${
                      product.isAvailable === false
                      ? 'border-neutral-300 text-neutral-400 bg-neutral-50 cursor-not-allowed'
                      : 'border-green-600 text-green-600 bg-transparent hover:bg-green-50'
                    }`}
                  >
                    {product.isAvailable === false ? 'Out of Range' : 'ADD'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 bg-white border border-green-600 rounded-full px-1.5 py-0.5 h-7 w-full">
                <Button
                  variant="default"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDecrease(e);
                  }}
                  className="w-5 h-5 p-0 bg-transparent text-green-600 hover:bg-green-50 shadow-none"
                  aria-label="Decrease quantity"
                >
                  −
                </Button>
                <span className="text-xs font-bold text-green-600 min-w-[1rem] text-center">
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
                  className={`w-5 h-5 p-0 bg-transparent text-green-600 shadow-none ${
                    product.isAvailable === false ? 'text-neutral-300 cursor-not-allowed' : 'hover:bg-green-50'
                  }`}
                  aria-label="Increase quantity"
                >
                  +
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
              {!showPackBadge && (product.pack || product.variations?.[0]?.value) && (
                <p className="text-[9px] text-neutral-600 mb-0.5 leading-tight">
                  {product.variations?.[0]?.value || product.pack}
                </p>
              )}

              {/* 2. Name */}
              <h3 className="text-[10px] font-bold text-neutral-900 mb-0.5 line-clamp-2 leading-tight min-h-[1.75rem] max-h-[1.75rem] overflow-hidden">
                {product.name || product.productName || ''}
              </h3>

              {/* 2.5. Rating */}
              <div className="mb-0.5">
                <StarRating
                  rating={(product.rating || (product as any).rating) || 0}
                  reviewCount={(product.reviews || (product as any).reviewsCount) || 0}
                  size="sm"
                  showCount={true}
                />
              </div>

              {/* 3. Time */}
              <p className="text-[9px] text-neutral-600 mb-0.5 flex items-center gap-0.5 leading-tight">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>14 MINS</span>
              </p>

              {/* 4. Tiered Pricing Static Display (Multi-Row) */}
              {tieredPrices.length > 0 ? (
                 <div className="flex flex-col gap-0.5 mb-1 mt-auto w-full border-t border-gray-100 pt-1">
                    {/* Line 1: Base Price */}
                    <div className="flex justify-between items-center text-[9px] leading-tight">
                       <span className="text-gray-500 font-medium">1 unit</span>
                       <div className="flex items-center gap-1">
                         <span className="font-semibold text-gray-700">₹{displayPrice}</span>
                         {/* Optional: Show base discount if needed, but keeping it clean for list */}
                       </div>
                    </div>
                    {/* Additional Tiers */}
                    {tieredPrices.slice().sort((a: any, b: any) => a.minQty - b.minQty).map((tier: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[9px] leading-tight">
                           <span className="text-green-600 font-bold">{tier.minQty}+ units</span>
                           <div className="flex items-center gap-1">
                             <span className="font-bold text-gray-900">₹{tier.price}</span>
                             <span className="text-green-600 font-bold bg-green-50 px-1 rounded-sm">
                               {Math.round(((mrp - tier.price) / mrp) * 100)}% OFF
                             </span>
                           </div>
                        </div>
                    ))}
                 </div>
              ) : (
                 discount > 0 && (
                  <p className="text-[9px] font-semibold text-green-600 mb-0.5 leading-tight">
                    {discount}% OFF
                  </p>
                 )
              )}

              {/* 5. Price with discount */}
              <div className="mt-auto">
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className="text-[11px] font-bold text-neutral-900 leading-tight">
                    ₹{currentUnitPrice.toLocaleString('en-IN')}
                  </span>
                  {mrp && mrp > displayPrice && (
                    <span className="text-[8px] text-neutral-500 line-through leading-tight">
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
                    {product.variations?.[0]?.value || product.pack}
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
                              <span className="font-bold text-gray-800">₹{displayPrice}</span>
                          </div>
                      </div>
                      {/* Additional Tiers */}
                      {tieredPrices.map((tier: any, idx: number) => {
                          const tierDiscount = mrp ? Math.round(((mrp - tier.price) / mrp) * 100) : 0;
                          return (
                              <div key={idx} className="flex justify-between items-center bg-teal-50 px-2 py-1 rounded text-[10px] border border-teal-100">
                                  <span className="font-bold text-teal-800">Buy {tier.minQty}+</span>
                                  <div className="flex items-center gap-1">
                                      <span className="font-bold text-teal-700">₹{tier.price}</span>
                                      {tierDiscount > 0 && <span className="text-[9px] text-teal-600 font-bold">({tierDiscount}% OFF)</span>}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}

              {showStockInfo && (
                <p className="text-xs text-green-600 mb-2 font-medium">
                  Fast delivery
                </p>
              )}

              {showVegetarianIcon && (
                <div className="flex items-center gap-1 mb-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span className="text-xs text-neutral-600">Vegetarian</span>
                </div>
              )}

              <div className="mt-auto mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-base font-bold text-neutral-900">
                    ₹{displayPrice}
                  </span>
                  {mrp && mrp > displayPrice && (
                    <span className="text-xs text-neutral-500 line-through">
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
                  variant="outline"
                  size="sm"
                  disabled={product.isAvailable === false}
                  onClick={handleAdd}
                  className={`w-full border h-8 text-xs font-semibold uppercase tracking-wide ${
                    product.isAvailable === false
                    ? 'border-neutral-300 text-neutral-400 bg-neutral-50 cursor-not-allowed'
                    : 'border-green-600 text-green-600 hover:bg-green-50'
                  }`}
                >
                  {product.isAvailable === false ? 'Out of Range' : 'Add'}
                </Button>
                <div className="h-4 mt-1">
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 bg-white border border-green-600 rounded-full px-2 py-0.5 h-8">
                <Button
                  variant="default"
                  size="icon"
                  onClick={handleDecrease}
                  className="w-6 h-6 p-0 bg-transparent text-green-600 hover:bg-green-50 shadow-none"
                  aria-label="Decrease quantity"
                >
                  −
                </Button>
                <span className="text-xs font-bold text-green-600 min-w-[1.5rem] text-center">
                  {inCartQty}
                </span>
                <Button
                  variant="default"
                  size="icon"
                  disabled={product.isAvailable === false}
                  onClick={handleIncrease}
                  className={`w-6 h-6 p-0 bg-transparent text-green-600 shadow-none ${
                    product.isAvailable === false ? 'text-neutral-300 cursor-not-allowed' : 'hover:bg-green-50'
                  }`}
                  aria-label="Increase quantity"
                >
                  +
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
