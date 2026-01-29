import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProductCard from "./components/ProductCard";
import { getProducts, getProductById } from "../../services/api/customerProductService";
import { bannerService } from "../../services/bannerService";
import { useThemeContext } from "../../context/ThemeContext";
import { getTheme } from "../../utils/themes";

export default function FlashDealsPage() {
  const navigate = useNavigate();
  const { activeCategory } = useThemeContext();
  const theme = getTheme(activeCategory || "all");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlashDeals = async () => {
      setLoading(true);
      setError(null);
      try {
        const configResponse = await bannerService.getDealsConfig();
        let fetchedProducts: any[] = [];

        // 1. Specific IDs from Flash Deal configuration
        if (configResponse.flashDealProductIds && configResponse.flashDealProductIds.length > 0) {
          const promises = configResponse.flashDealProductIds.map((id: string) => getProductById(id));
          const results = await Promise.all(promises);
          fetchedProducts = results
            .filter((res) => res.success && res.data)
            .map((res) => ({
              ...res.data,
              id: (res.data as any)._id || (res.data as any).id,
            }));
        }

        setProducts(fetchedProducts);
      } catch (err) {
        console.error("Error fetching flash deals:", err);
        setError("Failed to load deals. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchFlashDeals();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="px-4 md:px-6 lg:px-8 py-3 md:py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18L9 12L15 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col">
            <h1 className="text-base md:text-xl font-bold text-neutral-900 leading-tight">Flash Deals</h1>
            <p className="text-[10px] md:text-xs text-neutral-500 font-medium tracking-tight">Limited time offers you can't miss</p>
          </div>
        </div>
      </div>

      {/* Hero Banner Area */}
      <div
        className="px-4 md:px-6 lg:px-8 py-6 md:py-10 text-white"
        style={{ background: `linear-gradient(135deg, ${theme.primary[0]} 0%, ${theme.primary[2]} 100%)` }}
      >
        <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-black mb-2 tracking-tighter">GRAB THE DEALS!</h2>
            <p className="text-white/80 text-sm md:text-base font-medium">Hurry Up! The offer is limited. Grab while it lasts</p>
        </div>
      </div>

      {/* Products Grid */}
      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-10 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-white rounded-2xl animate-pulse border border-neutral-100 shadow-sm" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-neutral-500 bg-white p-6 rounded-2xl shadow-sm inline-block border border-neutral-100">
              {error}
            </p>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                showBadge={true}
                categoryStyle={true}
                showStockInfo={false}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-neutral-500 font-medium">No active flash deals found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
