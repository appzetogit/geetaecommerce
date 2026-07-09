import { useRef, useState, useEffect, useMemo, memo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getProducts } from '../../../services/api/customerProductService';

import { useCart } from '../../../context/CartContext';
import { Product } from '../../../types/domain';
import { useWishlist } from '../../../hooks/useWishlist';
import { calculateProductPrice } from '../../../utils/priceUtils';

interface LowestPricesEverProps {
  activeTab?: string;
  products?: Product[]; // Admin-selected products from home data
}

// Helper function to truncate text to a maximum length
const truncateText = (text: string, maxLength: number = 60): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

// Product Card Component - Defined outside to prevent recreation on every render
const ProductCard = memo(({
  product,
  cartQuantity,
  onAddToCart,
  onUpdateQuantity
}: {
  product: Product;
  cartQuantity: number;
  onAddToCart: (product: Product, element?: HTMLElement | null) => void;
  onUpdateQuantity: (productId: string, quantity: number, variantId?: string, variantTitle?: string) => void;
}) => {
  const navigate = useNavigate();
  const { isWishlisted, toggleWishlist } = useWishlist(product.id);

  // Get Price and MRP using utility
  const { displayPrice, mrp, discount, hasDiscount } = calculateProductPrice(product);

  // Use cartQuantity from props
  const inCartQty = cartQuantity;

  // Get product name, clean it (remove description suffixes), and truncate if needed
  let productName = (typeof product.name === 'string' ? product.name : null) ||
                   (typeof product.productName === 'string' ? product.productName : null) || '';
  // Remove common description patterns like " - Fresh & Quality Assured", " - Premium Quality", etc.
  productName = productName.replace(/\s*-\s*(Fresh|Quality|Assured|Premium|Best|Top|Hygienic|Carefully|Selected).*$/i, '').trim();
  const displayName = truncateText(productName, 60);

  return (
    <div
      className="flex-shrink-0 w-[140px]"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div
        onClick={() => navigate(`/product/${product.id}`)}
        className="bg-white rounded-xl overflow-hidden flex flex-col relative h-full max-h-full cursor-pointer border border-neutral-100 hover:shadow-md transition-shadow"
      >
        {/* Product Image Area */}
        <div className="relative block">
          <div className="w-full h-36 bg-neutral-50 flex items-center justify-center overflow-hidden relative">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl">
                {(product.name || product.productName || '?').charAt(0).toUpperCase()}
              </div>
            )}

            {/* Red Discount Badge - Top Left */}
            {discount > 0 && (
              <div
                  className="absolute top-0 left-0 z-10 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-br-lg flex items-center gap-0.5 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, var(--customer-primary) 0%, var(--customer-primary-dark) 100%)' }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
                <span>{discount}% OFF</span>
              </div>
            )}

            {/* Heart Icon - Top Right */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWishlist(e);
              }}
              className="absolute top-1 right-1 z-30 w-7 h-7 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={isWishlisted ? "var(--customer-primary)" : "none"}
                xmlns="http://www.w3.org/2000/svg"
                className={isWishlisted ? "text-[var(--customer-primary)]" : "text-neutral-700"}
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

            {/* ADD Button or Quantity Stepper - Overlaid on bottom right of image */}
            <div className="absolute bottom-1.5 right-1.5 z-20">
              <AnimatePresence mode="wait">
                {inCartQty === 0 ? (
                  <motion.button
                    key="add-button"
                    type="button"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    disabled={product.isAvailable === false}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAddToCart(product, e.currentTarget);
                    }}
                    className={`rounded-full font-bold text-[9px] h-6 px-3 flex items-center justify-center gap-1 uppercase tracking-wider transition-all duration-300 border shadow-sm ${
                      product.isAvailable === false
                      ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
                      : 'bg-white/95 backdrop-blur-sm text-[var(--customer-primary)] border-[var(--customer-primary)] hover:bg-[var(--customer-primary-dark)] hover:text-white hover:border-[var(--customer-primary-dark)]'
                    }`}
                  >
                    {product.isAvailable === false ? (
                      'Out'
                    ) : (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        <span>ADD</span>
                      </>
                    )}
                  </motion.button>
                ) : (
                  <motion.div
                    key="stepper"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1.5 bg-[var(--customer-primary-alpha-10)] rounded-full px-1 py-0.5 h-6 border border-[var(--customer-primary-alpha-30)] shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onUpdateQuantity(product.id, inCartQty - 1, undefined, product.pack);
                      }}
                      className="w-4 h-4 flex items-center justify-center bg-white hover:bg-[var(--customer-primary-alpha-20)] rounded-full shadow-sm text-[var(--customer-primary-dark)] transition-colors border border-[var(--customer-primary-alpha-20)]"
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </motion.button>
                    <motion.span
                      key={inCartQty}
                      initial={{ scale: 1.2, y: -1 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                      className="text-[var(--customer-primary-dark)] font-black min-w-[0.75rem] text-center"
                      style={{ fontSize: '10px' }}
                    >
                      {inCartQty}
                    </motion.span>
                    <motion.button
                      whileTap={product.isAvailable === false ? {} : { scale: 0.9 }}
                      disabled={product.isAvailable === false}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onUpdateQuantity(product.id, inCartQty + 1, undefined, product.pack);
                      }}
                      className={`w-4 h-4 flex items-center justify-center bg-white hover:bg-[var(--customer-primary-alpha-20)] rounded-full shadow-sm text-[var(--customer-primary-dark)] transition-colors border border-[var(--customer-primary-alpha-20)] ${
                        product.isAvailable === false ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Product Details */}
        <div className="p-2 flex-1 flex flex-col min-h-0 bg-white">
          {/* Light Grey Tags */}
          <div className="flex gap-0.5 mb-1">
            <div className="bg-neutral-100 text-neutral-600 text-[8px] font-medium px-1.5 py-0.5 rounded">
              {product.pack || '1 unit'}
            </div>
          </div>

          {/* Product Name */}
          <div className="mb-1">
            <h3 className="text-[10px] font-bold text-neutral-900 line-clamp-2 leading-tight overflow-hidden" title={productName}>
              {displayName}
            </h3>
          </div>

          {/* Rating and Reviews */}
          <div className="flex items-center gap-0.5 mb-0.5">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill={i < 4 ? '#fbbf24' : '#e5e7eb'}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <span className="text-[8px] text-neutral-500">(85)</span>
          </div>

          {/* Delivery Time */}
          <div className="text-[9px] text-neutral-500 mb-1 flex items-center gap-0.5 leading-none">
             <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
               <circle cx="12" cy="12" r="10" />
               <path d="M12 6v6l4 2" />
             </svg>
            <span>20 MINS</span>
          </div>

          {/* Discount - Red Text */}
          {discount > 0 && (
            <div className="text-[9px] text-[var(--customer-primary)] font-bold mb-1 leading-none">
              {discount}% OFF
            </div>
          )}

          {/* Price */}
          <div className="mb-2 mt-auto">
            <div className="flex items-baseline gap-1">
              <span className="text-[13px] font-bold text-[var(--customer-primary)]">
                ₹{displayPrice.toLocaleString('en-IN')}
              </span>
              {hasDiscount && (
                <span className="text-[9px] text-red-400 line-through">
                  ₹{mrp.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>

          {/* Bottom Link */}
          <Link
            to={`/category/${product.categoryId || 'all'}`}
            className="w-full bg-[var(--customer-primary-alpha-10)] text-[var(--customer-primary)] text-[8px] font-bold py-1 rounded-lg flex items-center justify-between px-2 hover:bg-[var(--customer-primary-alpha-20)] transition-colors mt-auto cursor-pointer"
          >
            <span>See more like this</span>
            <div className="flex items-center gap-0.5">
              <div className="w-px h-2 bg-[var(--customer-primary-alpha-30)]"></div>
              <svg width="6" height="6" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0L8 4L0 8Z" fill="currentColor" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if the product ID or cart quantity changes
  // Functions are stable references, so we don't need to compare them
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.cartQuantity === nextProps.cartQuantity
  );
});

ProductCard.displayName = 'ProductCard';

import { useThemeContext } from '../../../context/ThemeContext';

export default function LowestPricesEver({ activeTab = 'all', products: adminProducts }: LowestPricesEverProps) {
  const { currentTheme: theme } = useThemeContext();
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { cart, addToCart, updateQuantity } = useCart();
  const [fontLoaded, setFontLoaded] = useState(false);

  // Preload and wait for font to load to prevent FOUT
  useEffect(() => {
    if (document.fonts && document.fonts.check) {
      // Check if font is already loaded
      if (document.fonts.check('1em "Poppins"')) {
        setFontLoaded(true);
        return;
      }

      // Wait for font to load
      const checkFont = async () => {
        try {
          await document.fonts.load('1em "Poppins"');
          setFontLoaded(true);
        } catch (e) {
          // Fallback: show after timeout
          setTimeout(() => setFontLoaded(true), 300);
        }
      };

      checkFont();
    } else {
      // Fallback for browsers without Font Loading API
      setTimeout(() => setFontLoaded(true), 300);
    }
  }, []);

  // Memoize cart items lookup for performance
  const cartItemsMap = useMemo(() => {
    const map = new Map();
    cart.items.forEach((item: any) => {
      if (item?.product) {
        // Use composite key of ID + Pack to distinguish variants
        const prod = item.product;
        const pack = prod.pack || prod.variantTitle || '';
        const prodId = prod.id || prod._id;
        map.set(`${prodId}-${pack}`, item.quantity);
      }
    });
    return map;
  }, [cart.items]);

  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    // Lowest Prices Ever is admin-controlled only. No automatic fallback products.
    if (!adminProducts || adminProducts.length === 0) {
      setProducts([]);
      return;
    }

    const mappedProducts = adminProducts.map((p: any) => {
      // Get product name and remove any description-like suffixes
      let productName = p.productName || p.name || '';
      productName = productName
        .replace(/\s*-\s*(Fresh|Quality|Assured|Premium|Best|Top|Hygienic|Carefully|Selected).*$/i, '')
        .trim();

      // Get pack without description
      let packValue = p.variations?.[0]?.title || p.pack || 'Standard';
      if (packValue && packValue.includes(' - ')) {
        packValue = packValue.split(' - ')[0].trim();
      }

      return {
        ...p,
        id: p._id || p.id || p.id,
        name: productName,
        imageUrl: p.mainImage || p.imageUrl || p.mainImage,
        mrp: p.mrp || p.price,
        pack: packValue,
      };
    });

    setProducts(mappedProducts);
  }, [adminProducts]);

  // Get products for this section
  // If using admin-selected products, use them directly (already filtered and ordered)
  // Otherwise, filter by activeTab and discount
  const getFilteredProducts = () => {
    // Admin-selected products are already curated/ordered.
    return products.slice(0, 20);
  };

  const discountedProducts = getFilteredProducts();

  // Memoize callbacks to prevent ProductCard re-renders
  const handleAddToCart = useCallback((product: Product, element?: HTMLElement | null) => {
    addToCart(product, element);
  }, [addToCart]);

  const handleUpdateQuantity = useCallback((productId: string, quantity: number, variantId?: string, variantTitle?: string) => {
    updateQuantity(productId, quantity, variantId, variantTitle);
  }, [updateQuantity]);

  if (!discountedProducts || discountedProducts.length === 0) {
    return null;
  }

  return (
    <div
      className="relative"
      style={{
        background: `linear-gradient(to bottom, ${theme.primary[3]}, ${theme.primary[3]}, ${theme.secondary[1]}, ${theme.secondary[2]})`,
        marginTop: '0px', // No gap for seamless blend
        paddingTop: '12px',
        paddingBottom: '16px',
      }}
    >
      {/* White Zip/Scalloped Divider at Top - Upward-pointing semicircles */}
      <div className="absolute top-0 left-0 right-0" style={{ height: '30px', zIndex: 10, opacity: 0.95 }}>
        <svg
          viewBox="0 0 1200 30"
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ display: 'block' }}
        >
          {/* White scalloped pattern with upward semicircles - clearly visible */}
          <path
            d="M0,30 L0,15
               Q25,0 50,15
               T100,15
               T150,15
               T200,15
               T250,15
               T300,15
               T350,15
               T400,15
               T450,15
               T500,15
               T550,15
               T600,15
               T650,15
               T700,15
               T750,15
               T800,15
               T850,15
               T900,15
               T950,15
               T1000,15
               T1050,15
               T1100,15
               T1150,15
               L1200,15
               L1200,30 Z"
            fill="white"
            stroke="white"
            strokeWidth="0"
          />
        </svg>
      </div>

      {/* LOWEST PRICES EVER Banner */}
      <div className="px-4 relative z-10" style={{ marginTop: '30px', marginBottom: '12px' }} data-section="lowest-prices">
        <div className="flex items-center justify-center gap-2 mb-1">
          {/* Left horizontal line */}
          <div className="flex-1 h-px bg-neutral-300"></div>

          <h2
            className="font-black text-center whitespace-nowrap"
            style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '28px',
              color: '#000000',
              opacity: fontLoaded ? 1 : 0,
              transition: 'opacity 0.2s ease-in',
              textShadow:
                '-1.5px -1.5px 0 white, 1.5px -1.5px 0 white, -1.5px 1.5px 0 white, 1.5px 1.5px 0 white, ' +
                '-1.5px 0px 0 white, 1.5px 0px 0 white, 0px -1.5px 0 white, 0px 1.5px 0 white, ' +
                '-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white, ' +
                '3px 3px 4px rgba(0, 0, 0, 0.5), ' +
                '2px 2px 3px rgba(0, 0, 0, 0.6), ' +
                '1px 1px 2px rgba(0, 0, 0, 0.7), ' +
                '0px 2px 1px rgba(0, 0, 0, 0.4)',
              letterSpacing: '0.8px',
              fontWeight: 900,
              lineHeight: '1.1',
              transform: 'perspective(500px) rotateX(2deg) rotateY(-1deg)',
              transformStyle: 'preserve-3d',
            } as React.CSSProperties}
          >
            LOWEST PRICES EVER
          </h2>

          {/* Right horizontal line */}
          <div className="flex-1 h-px bg-neutral-300"></div>
        </div>
      </div>

      {/* Horizontal Scrollable Product Cards */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-4"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {discountedProducts.map((product) => {
          // Use same composite key logic to retrieve quantity
          const pack = product.pack || '';
          const cartQuantity = cartItemsMap.get(`${product.id}-${pack}`) || 0;

          return (
            <ProductCard
              key={product.id}
              product={product}
              cartQuantity={cartQuantity}
              onAddToCart={handleAddToCart}
              onUpdateQuantity={handleUpdateQuantity}
            />
          );
        })}
      </div>

      <div className="flex justify-center px-4 pt-3">
        <button
          type="button"
          onClick={() => navigate('/lowest-prices-ever')}
          className="text-xs font-bold flex items-center gap-1 transition-colors bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full border border-neutral-200 text-[var(--customer-primary)] hover:bg-white shadow-sm"
        >
          View All
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
