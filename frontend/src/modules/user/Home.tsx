import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLocation as useRouterLocation, useNavigate, useNavigationType } from "react-router-dom";
import HomeHero from "./components/HomeHero";
import PromoStrip from "./components/PromoStrip";
import LowestPricesEver from "./components/LowestPricesEver";
import CategoryTileSection from "./components/CategoryTileSection";
import ProductCard from "./components/ProductCard";
import BannerSlider from "./components/banners/BannerSlider";
import HomePopup from "./components/banners/HomePopup";
import FlashDealSection from "./components/banners/FlashDealSection";
import FeaturedDeal from "./components/banners/FeaturedDeal";
import DealOfTheDay from "./components/banners/DealOfTheDay";
import FirstOrderOfferBanner from "./components/banners/FirstOrderOfferBanner";
import { getCachedHomeContent, getHomeContent } from "../../services/api/customerHomeService";
import { getHeaderCategoriesPublic } from "../../services/api/headerCategoryService";
import { getCachedProducts, getProducts as getCustomerProducts } from "../../services/api/customerProductService";
import { useLocation } from "../../hooks/useLocation";
import PageLoader from "../../components/PageLoader";
import { useThemeContext } from "../../context/ThemeContext";

interface LazyProductGridProps {
  products: any[];
  gridClassName: string;
  compact?: boolean;
  showStockInfo?: boolean;
  batchSize?: number;
}

function LazyProductGrid({
  products,
  gridClassName,
  compact = false,
  showStockInfo = true,
  batchSize = 8,
}: LazyProductGridProps) {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(batchSize, products.length));
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(Math.min(batchSize, products.length));
  }, [batchSize, products]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visibleCount >= products.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        setVisibleCount((current) => Math.min(current + batchSize, products.length));
      },
      {
        rootMargin: "220px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [batchSize, products.length, visibleCount]);

  return (
    <>
      <div className={gridClassName}>
        {products.slice(0, visibleCount).map((product) => (
          <ProductCard
            key={product.id || product._id}
            product={product}
            categoryStyle={true}
            showBadge={true}
            showPackBadge={false}
            showStockInfo={showStockInfo}
            compact={compact}
          />
        ))}
      </div>
      {visibleCount < products.length && (
        <div ref={sentinelRef} className="h-16 w-full" aria-hidden="true" />
      )}
    </>
  );
}


export default function Home() {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const navigationType = useNavigationType();
  const { location } = useLocation();
  const { activeCategory, setActiveCategory, currentTheme: theme } = useThemeContext();
  const activeTab = activeCategory;
  const setActiveTab = setActiveCategory;
  const contentRef = useRef<HTMLDivElement>(null);
  const limit = 1000;
  const [currentPage, setCurrentPage] = useState(1);
  const cachedHomeResponse = getCachedHomeContent(undefined, undefined, undefined);
  const cachedTabProductsResponse =
    activeTab && activeTab !== "all"
      ? getCachedProducts({
          headerCategorySlug: activeTab,
          page: currentPage,
          limit,
          latitude: location?.latitude,
          longitude: location?.longitude,
        })
      : null;

  // Web view: always start Home with "All" selected (mobile jaisa default).
  const didInitActiveTabRef = useRef(false);
  useEffect(() => {
    if (didInitActiveTabRef.current) return;
    didInitActiveTabRef.current = true;

    if (window.innerWidth >= 768 && activeTab !== "all") {
      setActiveTab("all");
    }
  }, [activeTab, setActiveTab]);

  // State for dynamic data
  const [loading, setLoading] = useState(!cachedHomeResponse?.data);
  const [error, setError] = useState<string | null>(null);
  const [homeData, setHomeData] = useState<any>(
    cachedHomeResponse?.data || {
      bestsellers: [],
      categories: [],
      homeSections: [],
      shops: [],
      promoBanners: [],
      trending: [],
      cookingIdeas: [],
    }
  );

  const [products, setProducts] = useState<any[]>(cachedHomeResponse?.data?.bestsellers || []);
  const [tabProducts, setTabProducts] = useState<any[]>(cachedTabProductsResponse?.data || []);
  const [totalPages, setTotalPages] = useState(cachedTabProductsResponse?.pagination?.pages || 1);
  const restoreTimeoutRef = useRef<number | null>(null);
  const didMountRef = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!cachedHomeResponse?.data) {
          setLoading(true);
        }
        setError(null);
        const response = await getHomeContent(undefined, undefined, undefined, true, 5 * 60 * 1000, true);
        if (response.success && response.data) {
          let finalData = { ...response.data };

          // Inject Seller Categories into homeSections. Customers must only
          // see Active seller-own categories — when a seller marks one as
          // Inactive on their portal it should disappear from the storefront.
          // Missing `status` is treated as Active for back-compat with legacy
          // localStorage payloads.
          const sellerCatsStorage = localStorage.getItem('seller_own_categories');
          if (sellerCatsStorage) {
            try {
              const sellerCats = JSON.parse(sellerCatsStorage);
              const activeSellerCats = (sellerCats as any[]).filter(
                (c) => c && (c.status === undefined || c.status === 'Active')
              );
              if (activeSellerCats.length > 0) {
                 const sellerSection = {
                      id: 'seller-categories-section-home',
                      title: 'Seller Categories',
                      type: 'category',
                      displayType: 'category',
                      columns: 4,
                      data: activeSellerCats.map((c: any) => ({
                          id: c._id,
                          name: c.name,
                          image: c.image,
                          categoryId: c._id,
                          type: 'category',
                          productImages: [c.image],
                          itemCount: c.totalSubcategory || 0
                      }))
                  };

                  // Append to homeSections if it exists, or create it
                  const existingSections = finalData.homeSections || [];
                  finalData.homeSections = [...existingSections, sellerSection];
              }
            } catch (e) {
              console.error("Error parsing seller categories in Home", e);
            }
          }

          setHomeData(finalData);

          if (finalData.bestsellers) {
            setProducts(finalData.bestsellers);
          }
        } else {
          setError("Failed to load content. Please try again.");
        }
      } catch (error: any) {
        console.error("Failed to fetch home content", error);

        // Provide more specific error messages
        let errorMessage = "Network error. Please check your connection.";

        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          errorMessage = "Cannot connect to the server. Please ensure the backend server is running and accessible.";
        } else if (error.response) {
          errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`;
        } else if (error.request) {
          errorMessage = "No response from server. Please check your internet connection or if the backend is running.";
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Preload PromoStrip data
    const preloadHeaderCategories = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const headerCategories = await getHeaderCategoriesPublic(true);
        const slugsToPreload = ['all', ...headerCategories.map(cat => cat.slug)];
        const batchSize = 2;
        for (let i = 0; i < slugsToPreload.length; i += batchSize) {
          const batch = slugsToPreload.slice(i, i + batchSize);
          await Promise.all(
            batch.map(slug =>
              getHomeContent(slug, undefined, undefined, true, 5 * 60 * 1000, true).catch(err => {
                console.debug(`Failed to preload data for ${slug}:`, err);
              })
            )
          );
          if (i + batchSize < slugsToPreload.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      } catch (error) {
        console.debug("Failed to preload header categories:", error);
      }
    };

    preloadHeaderCategories();
  }, []);

  useEffect(() => {
    return () => {
      if (restoreTimeoutRef.current !== null) {
        window.clearTimeout(restoreTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (navigationType !== "POP" || loading) {
      return;
    }

    const historyRestore = (routerLocation.state as any)?.scrollRestore;
    const effectiveValue =
      historyRestore?.source === "product-card" &&
      historyRestore?.pageKey === `${routerLocation.pathname}${routerLocation.search}`
        ? JSON.stringify(historyRestore)
        : null;

    if (!effectiveValue) {
      return;
    }

    let parsedSnapshot: { mainTop?: number; windowTop?: number; preferredTarget?: "main" | "window" } | null = null;
    try {
      parsedSnapshot = JSON.parse(effectiveValue);
    } catch {
      parsedSnapshot = { mainTop: Number(effectiveValue), windowTop: 0, preferredTarget: "main" };
    }

    const targetMainTop = Number(parsedSnapshot?.mainTop || 0);
    const targetWindowTop = Number(parsedSnapshot?.windowTop || 0);
    const preferredTarget = parsedSnapshot?.preferredTarget || "main";

    let attempts = 0;
    const restore = () => {
      const state = window.history.state?.usr;
      const targetProductId = state?.scrollRestore?.productId;

      if (targetProductId) {
        const productElement = document.getElementById(`product-${targetProductId}`);
        if (productElement) {
          productElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add highlight effect
          productElement.classList.add('ring-2', 'ring-[var(--customer-primary)]', 'ring-offset-2', 'transition-all');
          setTimeout(() => {
            productElement.classList.remove('ring-2', 'ring-[var(--customer-primary)]', 'ring-offset-2');
          }, 2000);

          // Cleanup restore state
          const currentHistoryState = window.history.state || {};
          const existingUserState = currentHistoryState.usr || {};
          if (existingUserState.scrollRestore) {
            window.history.replaceState(
              {
                ...currentHistoryState,
                usr: { ...existingUserState, scrollRestore: undefined },
              },
              '',
              window.location.href
            );
          }
          restoreTimeoutRef.current = null;
          return;
        }
      }

      const mainElement = document.querySelector("main");
      if (mainElement instanceof HTMLElement) {
        const maxMainTop = Math.max(0, mainElement.scrollHeight - mainElement.clientHeight);
        mainElement.scrollTop = Math.min(targetMainTop, maxMainTop);
      }

      window.scrollTo({
        top: targetWindowTop,
        left: 0,
        behavior: "instant",
      });

      const currentMainTop = mainElement instanceof HTMLElement ? mainElement.scrollTop : 0;
      const mainSettled = Math.abs(currentMainTop - targetMainTop) < 2 || targetMainTop === 0;
      const windowSettled = Math.abs(window.scrollY - targetWindowTop) < 2 || targetWindowTop === 0;
      const settled = preferredTarget === "window" ? windowSettled : mainSettled;

      if (settled || attempts >= 30) {
        const currentHistoryState = window.history.state || {};
        const existingUserState = currentHistoryState.usr || {};
        if (existingUserState.scrollRestore) {
          window.history.replaceState(
            {
              ...currentHistoryState,
              usr: {
                ...existingUserState,
                scrollRestore: undefined,
              },
            },
            '',
            window.location.href
          );
        }
        restoreTimeoutRef.current = null;
        return;
      }

      attempts += 1;
      restoreTimeoutRef.current = window.setTimeout(restore, 120);
    };

    requestAnimationFrame(restore);
  }, [loading, navigationType, routerLocation.pathname, routerLocation.search, homeData, tabProducts.length, products.length]);

  useLayoutEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (navigationType === "POP" && (routerLocation.state as any)?.scrollRestore?.source === "product-card") {
      return;
    }

    const mainElement = document.querySelector("main");
    if (mainElement instanceof HTMLElement) {
      mainElement.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [activeTab, navigationType, routerLocation.state]);

  const handleTabChange = (tabId: string) => {
    setCurrentPage(1);
    if (!tabId || tabId === "all") {
      setTabProducts([]);
      setTotalPages(1);
    } else {
      const nextCachedProducts = getCachedProducts({
        headerCategorySlug: tabId,
        page: 1,
        limit,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });
      setTabProducts(nextCachedProducts?.data || []);
      setTotalPages(nextCachedProducts?.pagination?.pages || 1);
    }
    setActiveTab(tabId);
  };

  useEffect(() => {
    const loadTabProducts = async () => {
      if (!activeTab || activeTab === "all") {
        setTabProducts([]);
        return;
      }
      try {
        const res = await getCustomerProducts({
          headerCategorySlug: activeTab,
          page: currentPage,
          limit: limit,
          latitude: location?.latitude,
          longitude: location?.longitude,
        });
        if ((res as any).success && Array.isArray((res as any).data)) {
          setTabProducts((res as any).data);
          if ((res as any).pagination) {
            setTotalPages((res as any).pagination.pages);
          }
        } else if (!cachedTabProductsResponse?.data) {
          setTabProducts([]);
        }
      } catch (e) {
        console.error("Failed to load tab products:", e);
        if (!cachedTabProductsResponse?.data) {
          setTabProducts([]);
        }
      }
    };
    void loadTabProducts();
  }, [activeTab, location?.latitude, location?.longitude, currentPage]);

  const getFilteredProducts = (tabId: string) => {
    if (tabId === "all") return products;
    // For header categories like Grocery/Beauty, show all products under that category.
    return tabProducts;
  };

  const filteredProducts = useMemo(
    () => getFilteredProducts(activeTab),
    [activeTab, products, tabProducts]
  );

  if (loading && !products.length) {
    return <PageLoader />;
  }

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
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

  return (
    <div className="bg-white min-h-screen pb-20 md:pb-0" ref={contentRef}>
      {/* 1. Popup Banner (First Visit) */}
      <HomePopup />

      {/* Hero Header with Gradient and Tabs */}
      <HomeHero activeTab={activeTab} onTabChange={handleTabChange} />

      {/* 2. MAIN SLIDER - With Themed Background */}
      <div
        className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-4"
        style={{ background: `linear-gradient(to bottom right, ${theme.primary[0]}, ${theme.primary[1]}, ${theme.primary[2]})` }}
      >
          <BannerSlider position="HOME_MAIN_SLIDER" />
      </div>

      {/* Promo Strip */}
      <PromoStrip activeTab={activeTab} />

      {/* LOWEST PRICES EVER Section */}
      <LowestPricesEver activeTab={activeTab} products={homeData.lowestPrices} />

      {/* FLASH DEAL Section - New addition */}
      {/* Moved inside main content wrapper to respect layout flow and negative margins */}

      {/* Main content */}
      <div
        ref={contentRef}
        className="-mt-2 pt-1 space-y-5 md:space-y-8 md:pt-4 pb-12"
        style={{ backgroundColor: theme.primary[3] }}
      >

        {/* FLASH DEAL Section */}
        <FlashDealSection />

        {/* Featured Deal Section */}
        <FeaturedDeal />

        {/* Bestsellers Section (Moved here as requested) */}
        {activeTab === "all" && homeData.bestsellers && homeData.bestsellers.length > 0 && (
            <div className="mt-2 md:mt-4">
              <CategoryTileSection
                title="Bestsellers"
                tiles={
                  homeData.bestsellers
                    .slice(0, 6)
                    .map((card: any) => {
                      return {
                        id: card.id,
                        categoryId: card.categoryId,
                        name: card.name || "Category",
                        productImages: card.productImages || [],
                        productCount: card.productCount || 0,
                      };
                    })
                }
                columns={3}
                showProductCount={true}
              />
            </div>
        )}

        {/* Deal of the Day Section */}
        <DealOfTheDay />

        {/* First Order Offer (First-time users) */}
        <FirstOrderOfferBanner />

        {/* Filtered Products Section */}
        {activeTab !== "all" && (
          <div data-products-section className="mt-6 mb-6 md:mt-8 md:mb-8">
            <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6 px-4 md:px-6 lg:px-8 tracking-tight capitalize">
              {activeTab === "grocery" ? "Grocery Items" : activeTab}
            </h2>
            <div className="px-4 md:px-6 lg:px-8">
              {filteredProducts.length > 0 ? (
                <LazyProductGrid
                  products={filteredProducts}
                  gridClassName="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4"
                  showStockInfo={true}
                  batchSize={10}
                />
              ) : (
                <div className="text-center py-12 md:py-16 text-neutral-500">
                  <p className="text-lg md:text-xl mb-2">No products found</p>
                  <p className="text-sm md:text-base">
                    Try selecting a different category
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bestsellers Section - Originally here, now moved up. Only keeping condition wrapper for other sections if needed */}
        {activeTab === "all" && (
          <>
            {/* Dynamic Home Sections - Render sections created by admin */}
            {homeData.homeSections && homeData.homeSections.length > 0 && (
              <>
                {homeData.homeSections.map((section: any) => {
                  const columnCount = Number(section.columns) || 4;

                  if (section.displayType === "products" && section.data && section.data.length > 0) {
                    const gridClass = {
                      2: "grid-cols-2",
                      3: "grid-cols-2 md:grid-cols-3",
                      4: "grid-cols-2 md:grid-cols-4",
                      6: "grid-cols-2 md:grid-cols-6",
                      8: "grid-cols-2 md:grid-cols-8"
                    }[columnCount] || "grid-cols-2 md:grid-cols-4";

                    const isCompact = columnCount >= 4;
                    const gapClass = columnCount >= 4 ? "gap-2" : "gap-3 md:gap-4";

                    return (
                      <div key={section.id} className="mt-6 mb-6 md:mt-8 md:mb-8">
                        {section.title && (
                          <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6 px-4 md:px-6 lg:px-8 tracking-tight capitalize">
                            {section.title}
                          </h2>
                        )}
                        <div className="px-4 md:px-6 lg:px-8">
                          <LazyProductGrid
                            products={section.data}
                            gridClassName={`grid ${gridClass} ${gapClass}`}
                            compact={isCompact}
                            showStockInfo={false}
                            batchSize={columnCount >= 6 ? 12 : 8}
                          />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <CategoryTileSection
                      key={section.id}
                      title={section.title}
                      tiles={section.data || []}
                      columns={columnCount as 2 | 3 | 4 | 6 | 8}
                      showProductCount={false}
                    />
                  );
                })}
              </>
            )}


            {/* Main Section Banner */}
            <div className="px-4 md:px-6 lg:px-8 mt-6 mb-6">
                <BannerSlider position="Main Section Banner" />
            </div>

            {/* Shop by Store Section */}
            <div className="mb-6 mt-6 md:mb-8 md:mt-8">
              <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6 px-4 md:px-6 lg:px-8 tracking-tight">
                Shop by Store
              </h2>
              <div className="px-4 md:px-6 lg:px-8">
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-4">
                  {(homeData.shops || []).map((tile: any) => {
                    const hasImages =
                      tile.image ||
                      (tile.productImages &&
                        tile.productImages.filter(Boolean).length > 0);

                    return (
                      <div key={tile.id} className="flex flex-col">
                        <div
                          onClick={() => {
                            const storeSlug =
                              tile.slug || tile.id.replace("-store", "");
                            navigate(`/store/${storeSlug}`);
                          }}
                          className="block bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                          {hasImages ? (
                            <img
                              src={
                                tile.image ||
                                (tile.productImages
                                  ? tile.productImages[0]
                                  : "")
                              }
                              alt={tile.name}
                              className="w-full h-16 object-cover"
                            />
                          ) : (
                            <div
                              className={`w-full h-16 flex items-center justify-center text-3xl text-neutral-300 ${tile.bgColor || "bg-neutral-50"
                                }`}>
                              {tile.name.charAt(0)}
                            </div>
                          )}
                        </div>

                        <div className="mt-1.5 text-center">
                          <span className="text-xs font-semibold text-neutral-900 line-clamp-2 leading-tight">
                            {tile.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer Banner */}
        <div className="px-4 md:px-6 lg:px-8 mt-6 mb-8">
             <BannerSlider position="Footer Banner" />
        </div>
      </div>
    </div>
  );
}
