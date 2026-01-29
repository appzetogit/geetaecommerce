import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import HomeHero from "./components/HomeHero";
import PromoStrip from "./components/PromoStrip";
import LowestPricesEver from "./components/LowestPricesEver";
import CategoryTileSection from "./components/CategoryTileSection";
import FeaturedThisWeek from "./components/FeaturedThisWeek";
import ProductCard from "./components/ProductCard";
import BannerSlider from "./components/banners/BannerSlider";
import HomePopup from "./components/banners/HomePopup";
import FlashDealSection from "./components/banners/FlashDealSection";
import FeaturedDeal from "./components/banners/FeaturedDeal";
import DealOfTheDay from "./components/banners/DealOfTheDay";
import { getHomeContent } from "../../services/api/customerHomeService";
import { getHeaderCategoriesPublic } from "../../services/api/headerCategoryService";
import { useLocation } from "../../hooks/useLocation";
import { useLoading } from "../../context/LoadingContext";
import PageLoader from "../../components/PageLoader";
import { useThemeContext } from "../../context/ThemeContext";
import { getTheme } from "../../utils/themes";

export default function Home() {
  const navigate = useNavigate();
  const { location } = useLocation();
  const { activeCategory, setActiveCategory } = useThemeContext();
  const { startRouteLoading, stopRouteLoading } = useLoading();
  const activeTab = activeCategory;
  const setActiveTab = setActiveCategory;
  const contentRef = useRef<HTMLDivElement>(null);

  const theme = getTheme(activeTab || 'all');

  // State for dynamic data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [homeData, setHomeData] = useState<any>({
    bestsellers: [],
    categories: [],
    homeSections: [],
    shops: [],
    promoBanners: [],
    trending: [],
    cookingIdeas: [],
  });

  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        startRouteLoading();
        setLoading(true);
        setError(null);
        const response = await getHomeContent(undefined);
        if (response.success && response.data) {
          setHomeData(response.data);

          if (response.data.bestsellers) {
            setProducts(response.data.bestsellers);
          }
        } else {
          setError("Failed to load content. Please try again.");
        }
      } catch (error: any) {
        console.error("Failed to fetch home content", error);

        // Provide more specific error messages
        let errorMessage = "Network error. Please check your connection.";

        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          errorMessage = "Cannot connect to the server. Please ensure the backend server is running on http://localhost:5000";
        } else if (error.response) {
          errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`;
        } else if (error.request) {
          errorMessage = "No response from server. Please check if the backend is running.";
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
        stopRouteLoading();
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
  }, [location?.latitude, location?.longitude]);

  const getFilteredProducts = (tabId: string) => {
    if (tabId === "all") {
      return products;
    }
    return products.filter(
      (p) =>
        p.categoryId === tabId ||
        (p.category && (p.category._id === tabId || p.category.slug === tabId))
    );
  };

  const filteredProducts = useMemo(
    () => getFilteredProducts(activeTab),
    [activeTab, products]
  );

  if (loading && !products.length) {
    return <PageLoader />;
  }

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Oops! Something went wrong</h3>
        <p className="text-gray-600 mb-6 max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-green-600 text-white rounded-full font-medium hover:bg-green-700 transition-colors"
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
      <HomeHero activeTab={activeTab} onTabChange={setActiveTab} />

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
        className="bg-neutral-50 -mt-2 pt-1 space-y-5 md:space-y-8 md:pt-4">

        {/* FLASH DEAL Section */}
        <FlashDealSection />

        {/* Featured Deal Section */}
        <FeaturedDeal />

        {/* Bestsellers Section (Moved here as requested) */}
        {activeTab === "all" && (
            <div className="mt-2 md:mt-4">
              <CategoryTileSection
                title="Bestsellers"
                tiles={
                  homeData.bestsellers && homeData.bestsellers.length > 0
                    ? homeData.bestsellers
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
                    : []
                }
                columns={3}
                showProductCount={true}
              />
            </div>
        )}

        {/* Deal of the Day Section */}
        <DealOfTheDay />

        {/* Filtered Products Section */}
        {activeTab !== "all" && (
          <div data-products-section className="mt-6 mb-6 md:mt-8 md:mb-8">
            <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6 px-4 md:px-6 lg:px-8 tracking-tight capitalize">
              {activeTab === "grocery" ? "Grocery Items" : activeTab}
            </h2>
            <div className="px-4 md:px-6 lg:px-8">
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      categoryStyle={true}
                      showBadge={true}
                      showPackBadge={false}
                      showStockInfo={true}
                    />
                  ))}
                </div>
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
            {/* Featured this week Section */}
            <FeaturedThisWeek />

            {/* Dynamic Home Sections - Render sections created by admin */}
            {homeData.homeSections && homeData.homeSections.length > 0 && (
              <>
                {homeData.homeSections.map((section: any) => {
                  const columnCount = Number(section.columns) || 4;

                  if (section.displayType === "products" && section.data && section.data.length > 0) {
                    const gridClass = {
                      2: "grid-cols-2",
                      3: "grid-cols-3",
                      4: "grid-cols-4",
                      6: "grid-cols-6",
                      8: "grid-cols-8"
                    }[columnCount] || "grid-cols-4";

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
                          <div className={`grid ${gridClass} ${gapClass}`}>
                            {section.data.map((product: any) => (
                              <ProductCard
                                key={product.id || product._id}
                                product={product}
                                categoryStyle={true}
                                showBadge={true}
                                showPackBadge={false}
                                showStockInfo={false}
                                compact={isCompact}
                              />
                            ))}
                          </div>
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
