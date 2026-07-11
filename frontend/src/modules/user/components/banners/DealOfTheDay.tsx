import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProductById } from '../../../../services/api/customerProductService';
import { Product } from '../../../../types/domain';
import { calculateCardPrice } from '../../../../utils/priceUtils';
import { mapApiProductForCustomerDisplay } from '../../../../utils/customerVariantUtils';
import { bannerService } from '../../../../services/bannerService';
import BannerSlider from './BannerSlider';

// Admin-managed Customer App Theme tokens. Replaces the previously hardcoded
// orange palette so this admin-curated section follows the brand color picked
// in the Customer App Theme settings instead of being permanently orange.
const BRAND = {
  primary: 'var(--customer-primary)',
  primaryLight: 'var(--customer-primary-light)',
  tint: 'var(--customer-primary-alpha-10)',
  border: 'var(--customer-primary-alpha-30)',
};

export default function DealOfTheDay() {
  const navigate = useNavigate();
  const [dealProducts, setDealProducts] = useState<Product[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchDealProducts = async () => {
      try {
        const config = await bannerService.getDealsConfig();

        const products: Product[] = [];

        // Check for multiple IDs first
        if (config.dealOfTheDayProductIds && config.dealOfTheDayProductIds.length > 0) {
             const promises = config.dealOfTheDayProductIds.map(async (id) => {
                 try {
                     return await getProductById(id);
                 } catch (error) {
                     console.warn(`[DealOfTheDay] Product ID ${id} not found or error occurred:`, error);
                     return null;
                 }
             });
             const results = await Promise.all(promises);

             results.forEach(res => {
                 if (res && res.success && res.data) {
                     products.push(mapApiProductForCustomerDisplay(res.data));
                 }
             });
        }
        // Fallback to single ID (backward compatibility)
        else if ((config as any).dealOfTheDayProductId) {
             const res = await getProductById((config as any).dealOfTheDayProductId);
             if (res.success && res.data) {
                 products.push(mapApiProductForCustomerDisplay(res.data));
             }
        }

        // Fallback logic removed as per user request.
        // If no products are selected in admin, this section will not show random products.

        setDealProducts(products);

      } catch (err) {
        console.error("Failed to fetch deal of the day", err);
      }
    };
    fetchDealProducts();
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (dealProducts.length <= 1) return;

    const interval = setInterval(() => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollAmount = container.clientWidth;
            const maxScroll = container.scrollWidth - container.clientWidth;

            if (container.scrollLeft + scrollAmount >= maxScroll) {
                 container.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                 container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        }
    }, 4500);

    return () => clearInterval(interval);
  }, [dealProducts]);

  if (dealProducts.length === 0) {
    return (
      <div className="px-4 md:px-6 lg:px-8 mb-6">
        <BannerSlider position="Deal of the Day" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 lg:px-8 mb-6">
      <div className="mb-4">
        <BannerSlider position="Deal of the Day" />
      </div>
      <div
        className="rounded-xl p-6 md:p-8 text-center shadow-lg relative overflow-hidden flex flex-col gap-6"
        style={{
          background: `linear-gradient(to bottom, white, ${BRAND.tint})`,
          border: `1px solid ${BRAND.border}`
        }}
      >
          {/* Header */}
          <div
            className="flex justify-between items-center z-10 text-left border-b pb-4"
            style={{ borderColor: BRAND.border }}
          >
              <div>
                  <h3 className="text-2xl font-bold text-gray-800">Deal of the Day</h3>
                  <p className="text-sm text-gray-500 mt-1">Grab the best prices before they reset!</p>
              </div>
              <button
                onClick={() => navigate('/deal-of-the-day')}
                className="text-sm font-semibold flex items-center gap-1 transition-colors"
                style={{ color: BRAND.primary }}
              >
                  View All <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
          </div>

          {/* Large Cards Carousel */}
          <div
             ref={scrollContainerRef}
             className="flex overflow-x-auto gap-6 snap-x snap-mandatory scrollbar-hide py-2 text-left"
             style={{ scrollBehavior: 'smooth' }}
          >
              {dealProducts.map(product => {
                  const { displayPrice, mrp, discount } = calculateCardPrice(product);
                  return (
                      <div
                         key={product.id}
                         className="flex-none w-full md:w-[48%] lg:w-[40%] xl:w-[30%] snap-center bg-white rounded-xl p-6 shadow-md border flex flex-col items-center gap-4 cursor-pointer hover:shadow-xl transition-shadow relative"
                         style={{ borderColor: BRAND.border }}
                         onClick={() => navigate(`/product/${product.id}`)}
                      >
                         <div
                            className="absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full bg-white border"
                            style={{ color: BRAND.primary, borderColor: BRAND.border }}
                         >
                             Active Deal
                         </div>

                         <div className="relative w-48 h-48 flex-shrink-0 bg-transparent p-2 flex items-center justify-center">
                             {discount > 0 && (
                                <span
                                    className="absolute -top-1 -left-1 text-white text-sm font-bold px-3 py-1 rounded-full shadow-sm z-10"
                                    style={{ backgroundColor: 'var(--customer-primary)' }}
                                >
                                    {discount}% OFF
                                </span>
                             )}
                             <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-contain"
                             />
                         </div>

                         <div className="w-full text-center">
                             <h4 className="font-bold text-gray-900 text-lg md:text-xl line-clamp-2 mb-2">{product.name}</h4>
                             <div className="flex items-center justify-center gap-3">
                                 <span className="text-3xl font-bold" style={{ color: BRAND.primary }}>₹{displayPrice}</span>
                                 {mrp > displayPrice && (
                                    <span className="text-sm text-gray-400 line-through">₹{mrp}</span>
                                 )}
                             </div>
                             <button
                                className="mt-4 w-full text-white font-bold py-2 px-4 rounded-lg transition-colors"
                                style={{ backgroundColor: BRAND.primary }}
                             >
                                 View Deal
                             </button>
                         </div>
                      </div>
                  );
              })}
          </div>

          {/* Dots Indicator if multiple */}
          {dealProducts.length > 1 && (
             <div className="flex justify-center gap-2 mt-2">
                 {dealProducts.map((_, i) => (
                     <div key={i} className="w-2 h-2 rounded-full transition-colors" style={{ backgroundColor: BRAND.primaryLight }} />
                 ))}
             </div>
          )}
      </div>
    </div>
  );
}
