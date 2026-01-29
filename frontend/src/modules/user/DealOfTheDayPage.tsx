import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProductCard from "./components/ProductCard";
import { getProductById } from "../../services/api/customerProductService";
import { bannerService } from "../../services/bannerService";
import { useThemeContext } from "../../context/ThemeContext";
import { getTheme } from "../../utils/themes";

export default function DealOfTheDayPage() {
  const navigate = useNavigate();
  const { activeCategory } = useThemeContext();
  const theme = getTheme(activeCategory || "all");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeals = async () => {
      setLoading(true);
      setError(null);
      try {
        const configResponse = await bannerService.getDealsConfig();
        let fetchedProducts: any[] = [];

        // Fetch from specific Deal of the Day IDs
        if (configResponse.dealOfTheDayProductIds && configResponse.dealOfTheDayProductIds.length > 0) {
          const promises = configResponse.dealOfTheDayProductIds.map((id: string) => getProductById(id));
          const results = await Promise.all(promises);
          fetchedProducts = results
            .filter((res) => res.success && res.data)
            .map((res) => ({
              ...res.data,
              id: (res.data as any)._id || (res.data as any).id,
            }));
        } else if ((configResponse as any).dealOfTheDayProductId) {
             const res = await getProductById((configResponse as any).dealOfTheDayProductId);
             if (res.success && res.data) {
                 fetchedProducts.push({
                    ...res.data,
                    id: (res.data as any)._id || (res.data as any).id,
                 });
             }
        }

        setProducts(fetchedProducts);
      } catch (err) {
        console.error("Error fetching deals of the day:", err);
        setError("Failed to load deals. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
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
            <h1 className="text-base md:text-xl font-bold text-neutral-900 leading-tight">Deal of the Day</h1>
            <p className="text-[10px] md:text-xs text-neutral-500 font-medium tracking-tight">Handpicked savings just for today</p>
          </div>
        </div>
      </div>

      {/* Hero Banner Area */}
      <div
        className="px-4 md:px-6 lg:px-8 py-6 md:py-10 text-white"
        style={{ background: `linear-gradient(135deg, #FF6D00 0%, #FF9100 100%)` }}
      >
        <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-black mb-2 tracking-tighter uppercase">DEAL OF THE DAY</h2>
            <p className="text-white/80 text-sm md:text-base font-medium italic">Handpicked deals at unbeatable prices, only for 24 hours!</p>
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
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-neutral-100 inline-block">
                <span className="text-5xl mb-4 block">🔥</span>
                <p className="text-neutral-500 font-bold text-lg">No active deals found for today.</p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-6 px-8 py-3 bg-[#E65100] text-white rounded-xl font-bold hover:shadow-lg transition-all"
                >Continue Shopping</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
