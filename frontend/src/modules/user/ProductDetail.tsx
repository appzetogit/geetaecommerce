 import {
   useParams,
   useNavigate,
   useLocation as useRouterLocation,
 } from "react-router-dom";
 import { useRef, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
// import { products } from '../../data/products'; // REMOVED
// import { categories } from '../../data/categories'; // REMOVED
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../hooks/useLocation';
import { useLoading } from '../../context/LoadingContext';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/badge';
import { getProductById, getProducts } from '../../services/api/customerProductService';
import { getSimilarProducts as getSemanticSimilarProducts } from '../../services/api/searchService';
import WishlistButton from '../../components/WishlistButton';
import StarRating from "../../components/ui/StarRating";
import ProductCard from "./components/ProductCard";
import DealOfTheDay from "./components/banners/DealOfTheDay";
import FeaturedDeal from "./components/banners/FeaturedDeal";
import FlashDealSection from "./components/banners/FlashDealSection";
import { calculateProductPrice, getApplicableUnitPrice } from '../../utils/priceUtils';
import {
  findCartItemForPrimaryVariant,
  getVariantGallery,
  getVariantDisplayLabel,
  getVariantId,
  getVariantImage,
  getVariantLabel,
  matchesCartVariant,
  normalizeCustomerVariations,
  hasRealVariants,
} from '../../utils/customerVariantUtils';
import { resolveProductGallery } from '../../utils/productLegacyUtils';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const { cart, addToCart, updateQuantity } = useCart();
  const { location } = useLocation();
  const { startLoading, stopLoading } = useLoading();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [isProductDetailsExpanded, setIsProductDetailsExpanded] =
    useState(false);
  const [isHighlightsExpanded, setIsHighlightsExpanded] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  const searchSuggestions = ['atta', 'milk', 'dal', 'coke', 'bread', 'eggs', 'rice', 'oil'];
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSearchIndex((prev) => (prev + 1) % searchSuggestions.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);


  const [product, setProduct] = useState<any>(null);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAvailableAtLocation, setIsAvailableAtLocation] =
    useState<boolean>(true);

  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [similarProductsPage, setSimilarProductsPage] = useState(1);
  const [isSimilarLoading, setIsSimilarLoading] = useState(false);
  const [hasMoreSimilar, setHasMoreSimilar] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      startLoading();

      try {
        // Check if navigation came from store page
        const fromStore = (routerLocation.state as any)?.fromStore === true;

        // Fetch product details with location
        const response = await getProductById(
          id
          // location?.latitude,
          // location?.longitude
        );
        if (response.success && response.data) {
          const productData = response.data as any;
          const normalizedVariations = normalizeCustomerVariations(productData);

          // Set location availability flag
          setIsAvailableAtLocation(productData.isAvailableAtLocation !== false);

          setProduct({
            ...productData,
            variations: normalizedVariations,
            // Ensure all critical fields have safe defaults
            id: productData._id || productData.id,
            name: productData.productName || productData.name || "Product",
            imageUrl: productData.mainImage || productData.imageUrl || "",
            price: productData.price || 0,
            mrp: productData.mrp || productData.price || 0,
            pack:
              productData.pack ||
              productData.smallDescription ||
              getVariantLabel(normalizedVariations[0]) ||
              "Standard",
          });

          // Default to first created variant when variants exist
          setSelectedVariantIndex(normalizedVariations.length > 0 ? 0 : null);
          setSelectedImageIndex(0);
          const similar = response.data.similarProducts || [];
          setSimilarProducts(similar);
          setSimilarProductsPage(1);
          setHasMoreSimilar(similar.length >= 6);

          getSemanticSimilarProducts(id)
            .then((similarResponse) => {
              if (similarResponse.success && similarResponse.data.length > 0) {
                setSimilarProducts(similarResponse.data);
                const categoryId =
                  productData.subcategory?._id ||
                  productData.subcategory?.id ||
                  (typeof productData.subcategory === "string" ? productData.subcategory : null) ||
                  productData.category?._id ||
                  productData.category?.id ||
                  (typeof productData.category === "string" ? productData.category : null);
                setHasMoreSimilar(Boolean(categoryId));
              }
            })
            .catch((err) => {
              console.error("Failed to fetch semantic similar products", err);
            });

          // Fetch reviews
          fetchReviews(id);
        } else {
          setProduct(null);
          setError(response.message || "Product not found");
        }
      } catch (error: any) {
        console.error("Failed to fetch product", error);
        setProduct(null);
        setError(
          error.response?.data?.message ||
            error.message ||
            "Something went wrong while fetching product details"
        );
      } finally {
        setLoading(false);
        stopLoading();
      }
    };

    fetchProduct();
  }, [id, location?.latitude, location?.longitude]);

  const fetchReviews = async (productId: string) => {
    setReviewsLoading(true);
    try {
      const { getProductReviews } = await import(
        "../../services/api/customerReviewService"
      );
      const res = await getProductReviews(productId);
      if (res.success) {
        setReviews(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch reviews", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleLoadMoreSimilar = async () => {
    if (isSimilarLoading || !hasMoreSimilar || !product) return;
    
    setIsSimilarLoading(true);
    try {
      const nextPage = similarProductsPage + 1;
      // Use subcategory or category as fallback
      const targetCategoryId = product.subcategory?._id || product.subcategory?.id || (typeof product.subcategory === 'string' ? product.subcategory : null) || product.category?._id || product.category?.id || (typeof product.category === 'string' ? product.category : null);
      
      if (!targetCategoryId) {
        setHasMoreSimilar(false);
        return;
      }

      const response = await getProducts({
        category: targetCategoryId,
        page: nextPage,
        limit: 12, // Fetch more to ensure we have enough after filtering duplicates
        latitude: location?.latitude,
        longitude: location?.longitude
      });

      if (response.success && response.data) {
        const existingIds = new Set(similarProducts.map(p => p._id || p.id));
        const currentProductId = product._id || product.id;
        
        const newProducts = response.data.filter(
          (p: any) => 
            (p._id || p.id) !== currentProductId && 
            !existingIds.has(p._id || p.id)
        ).slice(0, 6);

        if (newProducts.length > 0) {
          setSimilarProducts(prev => [...prev, ...newProducts]);
          setSimilarProductsPage(nextPage);
        }
        
        // If we got fewer products than requested or it's clearly the end
        if (response.data.length < 6 || response.pagination.page >= response.pagination.pages) {
          setHasMoreSimilar(false);
        }
      } else {
        setHasMoreSimilar(false);
      }
    } catch (err) {
      console.error("Failed to load more similar products", err);
    } finally {
      setIsSimilarLoading(false);
    }
  };

  const hasVariations = hasRealVariants(product);
  const customerVariations = useMemo(
    () => (product ? normalizeCustomerVariations(product) : []),
    [product]
  );
  const effectiveVariantIndex = hasVariations ? (selectedVariantIndex ?? 0) : null;

  const allImages = useMemo(() => {
    if (!product) return [];
    if (customerVariations.length > 0 && effectiveVariantIndex !== null) {
      const variant = customerVariations[effectiveVariantIndex];
      const gallery = getVariantGallery(variant);
      if (gallery.length > 0) return gallery;
    }
    return resolveProductGallery(product);
  }, [product, customerVariations, effectiveVariantIndex]);

  // Reset gallery position when variant changes
  useEffect(() => {
    setSelectedImageIndex(0);
  }, [effectiveVariantIndex]);

  // Get selected variant
  const selectedVariant =
    hasVariations && effectiveVariantIndex !== null
      ? customerVariations[effectiveVariantIndex] || null
      : null;
  const activeVariationSelector =
    hasVariations && effectiveVariantIndex !== null ? effectiveVariantIndex : undefined;
  const variantTitle = selectedVariant
    ? getVariantDisplayLabel(selectedVariant, product) || product?.pack || "Standard"
    : product?.pack || "Standard";

  const cartItem = useMemo(() => {
    if (!product) return null;
    const productId = String(product.id || product._id);

    if (!hasVariations) {
      return findCartItemForPrimaryVariant(cart.items, product) ?? null;
    }

    return (
      cart.items.find((item) => {
        if (!item?.product) return false;
        const itemProductId = String(item.product.id || item.product._id);
        if (itemProductId !== productId) return false;
        if (!selectedVariant) return false;
        return matchesCartVariant(
          item.product,
          getVariantId(selectedVariant),
          variantTitle
        );
      }) ?? null
    );
  }, [cart.items, product, hasVariations, selectedVariant, variantTitle]);

  const { displayPrice: baseVariantPrice, mrp: variantMrp, discount: baseDiscount, hasDiscount: baseHasDiscount } = calculateProductPrice(product, activeVariationSelector);

  // Calculate dynamic price based on cart quantity
  const inCartQtyForCalc = Math.max(1, cartItem?.quantity || 0);

  const variantPrice = getApplicableUnitPrice(product, activeVariationSelector, inCartQtyForCalc);

  // Recalculate discount based on dynamic price
  const hasDiscount = variantMrp > variantPrice;
  const discount = hasDiscount ? Math.round(((variantMrp - variantPrice) / variantMrp) * 100) : 0;

  const variantStock = selectedVariant?.stock !== undefined ? selectedVariant.stock : (product?.stock || 0);
  const isVariantAvailable = selectedVariant?.status !== "Sold out" && (variantStock > 0 || variantStock === 0); // 0 means unlimited

  const variantCardOptions = useMemo(() => {
    if (!product || !customerVariations.length) return [];
    return customerVariations.map((variant: any, index: number) => {
      const { displayPrice, mrp } = calculateProductPrice(product, index);
      const stock = variant.stock !== undefined ? Number(variant.stock) : undefined;
      const isSoldOut = variant.status === "Sold out";
      const isOutOfStock = isSoldOut || (stock !== undefined && stock < 0);
      const inStock = !isSoldOut && (stock === undefined || stock > 0 || stock === 0);
      return {
        key: variant._id || variant.id || `variant-${index}`,
        index,
        title: getVariantDisplayLabel(variant, product) || getVariantLabel(variant) || `Variant ${index + 1}`,
        image: getVariantImage(variant),
        displayPrice,
        mrp,
        stock,
        isOutOfStock: !inStock,
        inStock,
      };
    });
  }, [customerVariations, product]);

  const formatVariantPriceParts = (amount: number) => {
    const safe = Number.isFinite(amount) ? amount : 0;
    const [whole, fraction = "00"] = safe.toFixed(2).split(".");
    return {
      whole: Number(whole).toLocaleString("en-IN"),
      fraction,
    };
  };

  const currentImage = allImages[selectedImageIndex] || product?.imageUrl || "";

  const variationImageMatches = useMemo(() => {
    const map = new Map<string, number[]>();
    for (let i = 0; i < customerVariations.length; i += 1) {
      for (const img of getVariantGallery(customerVariations[i])) {
        const existing = map.get(img) || [];
        existing.push(i);
        map.set(img, existing);
      }
    }
    return map;
  }, [customerVariations]);

  // If user changes the main image gallery (click/swipe), sync selected variant when the image uniquely matches a variant image.
  useEffect(() => {
    if (!currentImage) return;
    if (!product?.variations || !hasRealVariants(product)) return;
    const matches = variationImageMatches.get(currentImage);
    if (!matches || matches.length !== 1) return;
    const matchIndex = matches[0];
    if (matchIndex !== effectiveVariantIndex) {
      setSelectedVariantIndex(matchIndex);
    }
  }, [currentImage, product?.variations, effectiveVariantIndex, variationImageMatches]);

  // Minimum swipe distance (in pixels)
  const minSwipeDistance = 50;

  // Handle touch start
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  // Handle touch move
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  // Handle touch end - perform swipe
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && selectedImageIndex < allImages.length - 1) {
      setIsTransitioning(true);
      setSelectedImageIndex(selectedImageIndex + 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }

    if (isRightSwipe && selectedImageIndex > 0) {
      setIsTransitioning(true);
      setSelectedImageIndex(selectedImageIndex - 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  const inCartQty = cartItem?.quantity || 0;

  if (loading && !product) {
    return null; // Let the global IconLoader handle this
  }

  if (error && !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center bg-white">
        <div className="w-20 h-20 bg-[var(--customer-primary-alpha-10)] rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-[var(--customer-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Oops! Something went wrong</h3>
        <p className="text-gray-600 mb-6 max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-[var(--customer-primary-dark)] text-white rounded-full font-medium hover:bg-[var(--customer-primary-darker)] transition-colors"
        >
          Try Refreshing
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4 md:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-lg md:text-xl font-semibold text-neutral-900 mb-4">
            Product not found
          </p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Get category info - safe access
  const category =
    product.category && product.category.name
      ? { name: product.category.name, id: product.category._id }
      : null;

  const handleAddToCart = () => {
    if (!isAvailableAtLocation) {
      // Show alert if trying to add item outside delivery area
      alert("This product is not available for delivery at your location.");
      return;
    }
    if (!isVariantAvailable && variantStock !== 0) {
      alert("This variant is currently out of stock.");
      return;
    }
    // Create product with selected variant info
    const productWithVariant = {
      ...product,
      price: variantPrice,
      mrp: variantMrp,
      pack: variantTitle,
      selectedVariant: selectedVariant,
      variantId: getVariantId(selectedVariant),
      variantTitle: variantTitle,
    };
    addToCart(productWithVariant, addButtonRef.current);
  };

  const formatDeliveryTime = (raw: unknown, fallback: string) => {
    const text = raw === undefined || raw === null ? "" : String(raw).trim();
    if (!text) return fallback;
    if (/^\d+(\.\d+)?$/.test(text)) return `${text} MINS`;
    return text;
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header with back button and search */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Go back">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Search Bar */}
          <div className="flex-1 min-w-0" onClick={() => navigate('/search')}>
            <div className="relative">
              <div className="w-full h-10 pl-10 pr-4 rounded-full bg-neutral-100 flex items-center text-sm text-neutral-500 cursor-pointer overflow-hidden">
                <div className="relative h-4 w-full overflow-hidden">
                  {searchSuggestions.map((suggestion, index) => {
                    const isActive = index === currentSearchIndex;
                    const prevIndex = (currentSearchIndex - 1 + searchSuggestions.length) % searchSuggestions.length;
                    const isPrev = index === prevIndex;
                    return (
                      <div
                        key={suggestion}
                        className={`absolute inset-0 flex items-center transition-all duration-500 ${isActive ? 'translate-y-0 opacity-100' : isPrev ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0'}`}
                      >
                        <span className="text-xs text-neutral-500">
                          Search &apos;{suggestion}&apos;
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Heart icon */}
            {product?.id && (
              <WishlistButton
                productId={product.id}
                size="md"
                position="relative"
                className="!bg-transparent !shadow-none !rounded-full text-neutral-600 hover:bg-neutral-100 p-2"
              />
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="pt-16">
        {/* Location Availability Banner */}
        {!isAvailableAtLocation && (
          <div className="bg-[var(--customer-primary-alpha-10)] border-l-4 border-[var(--customer-primary)] px-4 py-3 mx-4 mt-4 rounded-r-lg">
            <div className="flex items-start gap-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="flex-shrink-0 mt-0.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#f59e0b" />
                <path
                  d="M2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--customer-primary-dark)]">
                  Not available at your location
                </p>
                <p className="text-xs text-[var(--customer-primary-dark)] mt-1">
                  This product cannot be delivered to your current location. You
                  can browse but cannot add to cart.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Product Image Gallery */}
        <div className="relative w-full bg-gradient-to-br from-neutral-100 to-neutral-200 overflow-hidden">
          {/* Main Product Image - Swipeable on mobile */}
          <div
            className="w-full aspect-square md:aspect-auto md:h-[500px] relative overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
              touchAction: allImages.length > 1 ? 'pan-x' : 'pan-y pinch-zoom',
              cursor: allImages.length > 1 ? 'grab' : 'default',
            }}
          >
            {/* Image Container with swipe animation - Mobile swipe carousel */}
            <div
              className="w-full h-full flex transition-transform duration-300 ease-out md:hidden"
              style={{
                transform: `translateX(-${selectedImageIndex * 100}%)`,
              }}
            >
              {allImages.map((image: string, index: number) => (
                <div
                  key={index}
                  className="w-full h-full flex-shrink-0 flex items-center justify-center relative"
                  style={{ minWidth: '100%' }}
                >
                  {image ? (
                    <img
                      src={image}
                      alt={`${product.name} - Image ${index + 1}`}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-6xl">
                      {(product.name || product.productName || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: Single image display - CONTAINED to ensure full visibility */}
            <div className="hidden md:flex w-full h-full items-center justify-center p-4">
            {currentImage ? (
              <img
                src={currentImage}
                alt={product.name}
                className="w-full h-full object-contain mix-blend-multiply"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-400 text-6xl">
                {(product.name || product.productName || "?")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}
            </div>

            {/* Image Gallery Navigation - Only show if multiple images */}
            {allImages.length > 1 && (
              <>
                {/* Previous Image Button - Desktop only */}
                {selectedImageIndex > 0 && (
                  <button
                    onClick={() => {
                      setIsTransitioning(true);
                      setSelectedImageIndex(selectedImageIndex - 1);
                      setTimeout(() => setIsTransitioning(false), 300);
                    }}
                    className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full items-center justify-center shadow-md hover:bg-white transition-colors z-10"
                    aria-label="Previous image">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M15 18l-6-6 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}

                {/* Next Image Button - Desktop only */}
                {selectedImageIndex < allImages.length - 1 && (
                  <button
                    onClick={() => {
                      setIsTransitioning(true);
                      setSelectedImageIndex(selectedImageIndex + 1);
                      setTimeout(() => setIsTransitioning(false), 300);
                    }}
                    className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full items-center justify-center shadow-md hover:bg-white transition-colors z-10"
                    aria-label="Next image">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M9 18l6-6-6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}

                {/* Image Indicators - Show on both mobile and desktop */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {allImages.map((_: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => {
                        setIsTransitioning(true);
                        setSelectedImageIndex(index);
                        setTimeout(() => setIsTransitioning(false), 300);
                      }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === selectedImageIndex
                          ? "bg-white w-6"
                          : "bg-white/50 hover:bg-white/75"
                      }`}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* "View Similar Products" pill — sits in the bottom-right of the product
                image. Records the productId we came from in sessionStorage and goes
                back; AppLayout reads that key on route change to scroll the previous
                listing to the matching product card and briefly highlight it. */}
            <button
              type="button"
              onClick={() => {
                const pid = product?.id || product?._id;
                if (pid) {
                  try {
                    sessionStorage.setItem(
                      'viewSimilarProducts.focusProductId',
                      String(pid)
                    );
                  } catch {
                    // sessionStorage can throw in private modes; the back navigation
                    // should still work, we just lose the auto-focus.
                  }
                }
                // Fall back to home if there's no history entry to pop (e.g. the
                // user landed on this page via a shared link).
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              aria-label="View similar products on the previous page"
              className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-md backdrop-blur-sm text-xs font-bold text-white hover:shadow-lg active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--customer-primary)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h13" />
                <path d="M8 7l-5 5 5 5" />
                <circle cx="20" cy="12" r="1.5" fill="currentColor" />
              </svg>
              View Similar Products
            </button>
          </div>

          {/* Thumbnail Gallery - Show below main image if multiple images */}
          {allImages.length > 1 && (
            <div className="px-4 py-2 bg-white/50 backdrop-blur-sm mb-4">
              {/* Mobile swipe hint */}
              <div className="md:hidden flex items-center justify-center gap-1 mb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-neutral-500">
                  <path d="M7 12l5-5M17 12l-5-5M12 7l-5 5M12 17l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-xs text-neutral-500">Swipe to view more</span>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 scroll-smooth">
                {allImages.map((image: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => {
                      setIsTransitioning(true);
                      setSelectedImageIndex(index);
                      setTimeout(() => setIsTransitioning(false), 300);
                    }}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      index === selectedImageIndex
                        ? "border-[var(--customer-primary-dark)] ring-2 ring-green-200"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}>
                    <img
                      src={image}
                      alt={`${product.name} - Image ${index + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Product Details Card - White section */}
        <div className="bg-white rounded-t-3xl -mt-6 relative z-10 px-4 md:px-6 lg:px-8 pt-2.5 md:pt-4 pb-2 md:pb-4">
          {/* Delivery time */}
          <div className="flex items-center gap-0.5 mb-1">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 6v6l4 2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-sm text-neutral-700 font-medium">
              {formatDeliveryTime((product as any)?.deliveryTime, "17 MINS")}
            </span>
          </div>

          {/* Product name */}
          <h2 className="text-lg md:text-2xl font-bold text-neutral-900 mb-0 leading-tight">
            {product.name}
          </h2>

          {/* Variant Selection */}
          {hasVariations && (
            <div className="mb-3">
              <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                {variantCardOptions.map((variantOption) => {
                  const isSelected = variantOption.index === effectiveVariantIndex;
                  const priceParts = formatVariantPriceParts(variantOption.displayPrice);
                  const showMrp = variantOption.mrp > variantOption.displayPrice;

                  return (
                    <button
                      key={variantOption.key}
                      type="button"
                      onClick={() => {
                        setSelectedVariantIndex(variantOption.index);
                        setSelectedImageIndex(0);
                      }}
                      disabled={variantOption.isOutOfStock}
                      className={`relative flex-shrink-0 w-[96px] md:w-[104px] rounded-md border bg-white p-1.5 text-left transition-all ${
                        isSelected
                          ? "border-[var(--customer-primary-dark)] shadow-sm"
                          : "border-neutral-200 hover:border-neutral-300"
                      } ${variantOption.isOutOfStock ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <div className="h-14 w-full mb-1 rounded bg-neutral-50 flex items-center justify-center overflow-hidden">
                        {variantOption.image ? (
                          <img
                            src={variantOption.image}
                            alt={variantOption.title}
                            className="max-h-full max-w-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-sm text-neutral-300 font-bold">
                            {variantOption.title.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] font-semibold text-neutral-900 line-clamp-2 leading-tight mb-0.5 min-h-[1.5rem]">
                        {variantOption.title}
                      </p>

                      <div className="leading-none">
                        <span className="text-[10px] text-neutral-900">₹</span>
                        <span className="text-sm font-semibold text-neutral-900">
                          {priceParts.whole}
                        </span>
                        <span className="text-[8px] align-super text-neutral-700">
                          {priceParts.fraction}
                        </span>
                      </div>

                      {showMrp && (
                        <p className="text-[9px] text-neutral-400 line-through leading-tight">
                          ₹{variantOption.mrp.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </p>
                      )}

                      <p
                        className={`text-[9px] mt-0.5 leading-tight ${
                          variantOption.inStock ? "text-green-700" : "text-neutral-400"
                        }`}
                      >
                        {variantOption.inStock ? "In stock" : "Out of stock"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price section — compact when variants already show per-card pricing */}
          {!hasVariations && (
            <p className="text-sm text-neutral-600 mb-1">
              {variantTitle}
            </p>
          )}

          {/* Price section */}
          <div className={`flex items-center gap-1.5 ${hasVariations ? "mb-1 mt-1" : "mb-1.5"}`}>
            <span className={`font-bold text-neutral-900 ${hasVariations ? "text-lg" : "text-xl"}`}>
              ₹{variantPrice.toLocaleString('en-IN')}
            </span>
            {hasDiscount && (
              <>
                <span className="text-sm text-neutral-500 line-through">
                  ₹{variantMrp.toLocaleString('en-IN')}
                </span>
                {discount > 0 && (
                  <Badge className="!bg-[var(--customer-primary)] !text-white !border-[var(--customer-primary)] text-xs px-1.5 py-0.5 rounded-full font-semibold">
                    {discount}% OFF
                  </Badge>
                )}
              </>
            )}
          </div>

          {/* Stock Status */}
          {variantStock !== 0 && variantStock !== undefined && variantStock !== null && (
            <p className={`text-neutral-600 mb-1 ${hasVariations ? "text-xs" : "text-sm"}`}>
              {variantStock > 0 ? `${variantStock} in stock` : "Out of stock"}
            </p>
          )}

          {/* Divider line */}
          <div className="border-t border-neutral-200 mb-1.5"></div>

          {/* View product details link */}
          <button
            onClick={() =>
              setIsProductDetailsExpanded(!isProductDetailsExpanded)
            }
            className="flex items-center gap-0.5 text-sm text-[var(--customer-primary-dark)] font-medium">
            View product details
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`transition-transform ${
                isProductDetailsExpanded ? "rotate-180" : ""
              }`}>
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Expanded Product Details Section */}
        {isProductDetailsExpanded && (
          <div className="mt-1.5">
            {/* Service Guarantees Card */}
            <div className="bg-white rounded-lg p-3 mb-2">
              <div className="grid grid-cols-3 gap-2">
                {/* Replacement */}
                <div className="flex flex-col items-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-1">
                    <path
                      d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3M20.49 15a9 9 0 0 1-14.85 3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-sm font-bold text-neutral-900">
                    48 hours
                  </span>
                  <span className="text-xs text-neutral-600">
                    Replacement
                  </span>
                </div>

                {/* Support */}
                <div className="flex flex-col items-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-1">
                    <path
                      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13 8H7M17 12H7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-sm font-bold text-neutral-900">
                    24/7
                  </span>
                  <span className="text-xs text-neutral-600">Support</span>
                </div>

                {/* Delivery */}
                <div className="flex flex-col items-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-1">
                    <path
                      d="M5 17H2l1-7h18l1 7h-3M5 17l-1-5h20l-1 5M5 17v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5M9 22h6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-sm font-bold text-neutral-900">
                    Fast
                  </span>
                  <span className="text-xs text-neutral-600">Delivery</span>
                </div>
              </div>
            </div>

            {/* Highlights Section */}
            <div className="bg-neutral-100 rounded-lg mb-2 overflow-hidden">
              <button
                onClick={() => setIsHighlightsExpanded(!isHighlightsExpanded)}
                className="w-full px-2 py-2.5 flex items-center justify-between bg-neutral-100">
                <span className="text-sm font-semibold text-neutral-700">
                  Highlights
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={`transition-transform ${
                    isHighlightsExpanded ? "rotate-180" : ""
                  }`}>
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {isHighlightsExpanded && (
                <div className="bg-white px-2 py-2">
                  <div className="space-y-1.5">
                    {product.tags && product.tags.length > 0 && (
                      <div className="flex items-start">
                        <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                          Key Features:
                        </span>
                        <span className="text-xs text-neutral-600">
                          {product.tags.map((tag: string, index: number) => (
                            <span key={tag}>
                              {tag
                                .replace(/-/g, " ")
                                .split(" ")
                                .map(
                                  (word: string) =>
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                )
                                .join(" ")}
                              {index < (product.tags?.length || 0) - 1
                                ? ", "
                                : ""}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Source:
                      </span>
                      <span className="text-xs text-neutral-600">
                        {product.madeIn || "From India"}
                      </span>
                    </div>
                    {category && (
                      <div className="flex items-start">
                        <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                          Category:
                        </span>
                        <span className="text-xs text-neutral-600">
                          {category.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="bg-neutral-100 rounded-lg overflow-hidden">
              <button
                onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                className="w-full px-2 py-2.5 flex items-center justify-between bg-neutral-100">
                <span className="text-sm font-semibold text-neutral-700">
                  Info
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={`transition-transform ${
                    isInfoExpanded ? "rotate-180" : ""
                  }`}>
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {isInfoExpanded && (
                <div className="bg-white px-2 py-2">
                  <div className="space-y-1.5">
                    {product.description && (
                      <div className="flex items-start">
                        <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                          Description:
                        </span>
                        <span className="text-xs text-neutral-600 leading-relaxed flex-1">
                          {product.description}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Unit:
                      </span>
                      <span className="text-xs text-neutral-600">
                        {product.pack}
                      </span>
                    </div>
                    {product.fssaiLicNo && (
                      <div className="flex items-start">
                        <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                          FSSAI License:
                        </span>
                        <span className="text-xs text-neutral-600">
                          {product.fssaiLicNo}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Shelf Life:
                      </span>
                      <span className="text-xs text-neutral-600">
                        Refer to package
                      </span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Disclaimer:
                      </span>
                      <span className="text-xs text-neutral-600 leading-relaxed flex-1">
                        Every effort is made to maintain accuracy of all
                        Information. However, actual product packaging and
                        materials may contain more and/or different information.
                        It is recommended not to solely rely on the information
                        presented.
                      </span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Customer Care Details:
                      </span>
                      <span className="text-xs text-neutral-600">
                        Email: help@Geeta Stores.com
                      </span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Country of Origin:
                      </span>
                      <span className="text-xs text-neutral-600">
                        {product.madeIn || "India"}
                      </span>
                    </div>
                    {product.manufacturer && (
                      <div className="flex items-start">
                        <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                          Manufacturer:
                        </span>
                        <span className="text-xs text-neutral-600 leading-relaxed flex-1">
                          {product.manufacturer}
                        </span>
                      </div>
                    )}
                    {/* Marketer same as manufacturer if not present, or hidden */}

                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Return Policy:
                      </span>
                      <span className="text-xs text-neutral-600 leading-relaxed flex-1">
                        {product.isReturnable
                          ? `This product is returnable within ${
                              product.maxReturnDays || 2
                            } days.`
                          : "This product is non-returnable."}
                      </span>
                    </div>
                    {product.sellerId && (
                      <div className="flex items-start">
                        <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                          Seller:
                        </span>
                        <span className="text-xs text-neutral-600 leading-relaxed flex-1">
                          Geeta Stores Partner (
                          {product.sellerId.slice(-6).toUpperCase()})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="bg-white px-4 md:px-6 lg:px-8 py-6 border-t border-neutral-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-neutral-900">
              Ratings & Reviews
            </h3>
            {reviews.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-neutral-900">
                  {product.rating || "4.5"}
                </span>
                <div className="flex text-yellow-500">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <span className="text-xs text-neutral-500">
                  ({reviews.length} reviews)
                </span>
              </div>
            )}
          </div>

          {reviewsLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--customer-primary-dark)]"></div>
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review._id}
                  className="border-b border-neutral-50 pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base font-semibold text-neutral-900">
                      {review.customer?.name || "Customer"}
                    </span>
                    <div className="flex items-center gap-1 bg-[var(--customer-primary-alpha-20)] px-1.5 py-0.5 rounded">
                      <span className="text-xs font-bold text-[var(--customer-primary-dark)]">
                        {review.rating}
                      </span>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="text-[var(--customer-primary-dark)]">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-600 leading-relaxed mb-1">
                    {review.comment}
                  </p>
                  <span className="text-xs text-neutral-400">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-neutral-500">
                No reviews yet. Be the first to review!
              </p>
            </div>
          )}
        </div>

        {/* View More from Brand Single Line Link */}
        {product?.brand && (
          <div className="px-4 md:px-6 lg:px-8 py-6 mb-2 border-b border-neutral-100 flex justify-center overflow-hidden">
            <motion.div
              whileHover={{ x: 5 }}
              onClick={() => {
                  const brandId = typeof product.brand === 'object' ? (product.brand._id || product.brand.id) : product.brand;
                  navigate(`/brand/${brandId}`);
              }}
              className="group cursor-pointer flex items-center gap-2 max-w-full"
            >
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  <span className="text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-[0.12em] text-neutral-400 whitespace-nowrap">
                    Explore more products from
                  </span>
                  <motion.div
                    whileHover={{ scale: 1.05, y: -1 }}
                    className="relative px-3 py-1 rounded-lg overflow-hidden flex items-center justify-center shadow-[0_4px_12px_rgba(239,68,68,0.25)] border border-white/10"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--customer-primary)] via-red-600 to-rose-700"></div>
                    <motion.div 
                      animate={{ x: ['-120%', '250%'] }}
                      transition={{ repeat: Infinity, duration: 3, ease: "linear", repeatDelay: 1 }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg]"
                    />
                    <span className="relative text-[11px] sm:text-[12px] md:text-sm font-black uppercase tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
                      {typeof product.brand === 'object' ? product.brand.name : 'this brand'}
                    </span>
                  </motion.div>
                  <span className="text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-[0.12em] text-neutral-400 whitespace-nowrap">
                    Brand
                  </span>
                </div>
              
              <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--customer-primary-alpha-10)] text-[var(--customer-primary)] group-hover:bg-[var(--customer-primary)] group-hover:text-white transition-all duration-300 shadow-sm ml-1">

                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </motion.div>
          </div>
        )}

        {/* Admin-curated deal sections (order: Deal of the Day → Featured Deals → Flash Deals).
            Mounted just above Similar Products so the customer always sees the promoted
            inventory before falling back to algorithmic similars. Each component already
            self-hides when the admin hasn't configured products for it. */}
        <div className="mt-2">
          <DealOfTheDay />
          <FeaturedDeal />
          <FlashDealSection />
        </div>

        {/* Similar products */}
        {similarProducts.length > 0 && (
          <div className="mt-6 mb-24">
            <div className="bg-neutral-100/50 border-t border-b border-neutral-200/50 py-4 px-3">
              <div className="flex items-center mb-4 px-1">
                <h3 className="text-lg font-semibold text-neutral-900">
                  Similar Products
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 pb-2 px-1">
                {similarProducts.map((similarProduct) => {
                  const similarCartItem = cart.items.find(
                    (item) =>
                      item?.product &&
                      (item.product.id === similarProduct.id ||
                        item.product.id === similarProduct._id)
                  );
                  const similarInCartQty = similarCartItem?.quantity || 0;

                  return (
                    <div key={similarProduct.id || similarProduct._id} className="w-full">
                      <ProductCard
                        product={similarProduct}
                        categoryStyle={true}
                        showBadge={true}
                        showHeartIcon={true}
                        showRating={true}
                        compact={true}
                      />
                    </div>
                  );
                })}
              </div>
              {(product?.subcategory?._id || product?.subcategory?.id || category?.id) && hasMoreSimilar && (
                <div className="relative z-[60] mt-6 flex justify-center pb-2">
                  <button
                    onClick={handleLoadMoreSimilar}
                    disabled={isSimilarLoading}
                    className="relative z-[60] text-sm font-semibold text-[var(--customer-primary-dark)] hover:text-[var(--customer-primary-dark)] transition-colors border border-[var(--customer-primary-dark)] px-6 py-2 rounded-full hover:bg-[var(--customer-primary-alpha-10)] shadow-sm disabled:opacity-50 min-w-[120px]"
                  >
                    {isSimilarLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-[var(--customer-primary-dark)] border-t-transparent rounded-full animate-spin"></div>
                        <span>loading...</span>
                      </div>
                    ) : 'view more'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 shadow-lg">
        <div className="px-4 py-2.5 flex items-center justify-between">
          {/* Left side - Product details */}
          <div className="flex-1">
            {/* First line - Pack size */}
            <div>
              <span className="text-sm text-neutral-900 font-medium">
                {variantTitle}
              </span>
            </div>
            {/* Second line - Price, MRP, and OFF */}
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold text-neutral-900">
                ₹{variantPrice.toLocaleString('en-IN')}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-xs text-neutral-500 line-through">
                    MRP ₹{variantMrp.toLocaleString('en-IN')}
                  </span>
                  {discount > 0 && (
                    <Badge className="!bg-[var(--customer-primary)] !text-white !border-[var(--customer-primary)] text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                      {discount}% OFF
                    </Badge>
                  )}
                </>
              )}
            </div>
            {/* Third line - Inclusive of all taxes */}
            <p className="text-[11px] text-neutral-500 leading-none">
              Inclusive of all taxes
            </p>
          </div>

          {/* Right side - Add to cart button or Quantity Stepper */}
          <div className="ml-3 flex items-center">
            <AnimatePresence mode="wait">
              {inCartQty === 0 ? (
                <motion.div
                  key="add-button"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center">
                  <Button
                    ref={addButtonRef}
                    variant="default"
                    size="default"
                    onClick={handleAddToCart}
                    disabled={!isAvailableAtLocation || (!isVariantAvailable && variantStock !== 0)}
                    className={`px-6 py-2 text-sm font-semibold h-[36px] ${
                      !isAvailableAtLocation || (!isVariantAvailable && variantStock !== 0)
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                    title={
                      !isAvailableAtLocation
                        ? "Not available at your location"
                        : !isVariantAvailable && variantStock !== 0
                        ? "This variant is out of stock"
                        : ""
                    }>
                    {!isAvailableAtLocation
                      ? "Unavailable"
                      : !isVariantAvailable && variantStock !== 0
                      ? "Out of Stock"
                      : "Add to cart"}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="stepper"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 bg-white border-2 border-[var(--customer-primary-dark)] rounded-full px-2 py-1 h-[36px]">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      const productId = product.id || product._id;
                      const variantId = selectedVariant?._id;
                      updateQuantity(productId, inCartQty - 1, variantId, variantTitle);
                    }}
                    className="w-6 h-6 flex items-center justify-center text-[var(--customer-primary-dark)] font-bold hover:bg-[var(--customer-primary-alpha-10)] rounded-full transition-colors border border-[var(--customer-primary-dark)] p-0 leading-none text-base"
                    style={{ lineHeight: 1 }}>
                    <span className="relative top-[-1px]">−</span>
                  </motion.button>
                  <motion.span
                    key={inCartQty}
                    initial={{ scale: 1.2, y: -2 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    className="text-sm font-bold text-[var(--customer-primary-dark)] min-w-[1.5rem] text-center">
                    {inCartQty}
                  </motion.span>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      const productId = product.id || product._id;
                      const variantId = selectedVariant?._id;
                      updateQuantity(productId, inCartQty + 1, variantId, variantTitle);
                    }}
                    className="w-6 h-6 flex items-center justify-center text-[var(--customer-primary-dark)] font-bold hover:bg-[var(--customer-primary-alpha-10)] rounded-full transition-colors border border-[var(--customer-primary-dark)] p-0 leading-none text-base"
                    style={{ lineHeight: 1 }}>
                    <span className="relative top-[-1px]">+</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
