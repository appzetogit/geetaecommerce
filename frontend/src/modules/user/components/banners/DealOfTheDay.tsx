import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTheme } from '../../../../utils/themes';
import { useThemeContext } from '../../../../context/ThemeContext';
import { getProducts, getProductById } from '../../../../services/api/customerProductService';
import { Product } from '../../../../types/domain';
import { calculateProductPrice } from '../../../../utils/priceUtils';
import { bannerService } from '../../../../services/bannerService';

export default function DealOfTheDay() {
  const navigate = useNavigate();
  const { activeCategory } = useThemeContext();
  const theme = getTheme(activeCategory || 'all');
  const [dealProducts, setDealProducts] = useState<Product[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchDealProducts = async () => {
      try {
        const config = await bannerService.getDealsConfig();

        let products: Product[] = [];

        // Check for multiple IDs first
        if (config.dealOfTheDayProductIds && config.dealOfTheDayProductIds.length > 0) {
             const promises = config.dealOfTheDayProductIds.map(id => getProductById(id));
             const results = await Promise.all(promises);

             results.forEach(res => {
                 if (res.success && res.data) {
                     products.push({
                        ...res.data,
                        id: (res.data as any)._id || (res.data as any).id,
                        imageUrl: (res.data as any).mainImage || (res.data as any).imageUrl,
                        name: (typeof (res.data as any).productName === 'string' ? (res.data as any).productName : null) ||
                              (typeof (res.data as any).name === 'string' ? (res.data as any).name : null) || 'Product',
                        price: (res.data as any).salePrice || (res.data as any).price,
                        mrp: (res.data as any).mrp,
                     } as any);
                 }
             });
        }
        // Fallback to single ID (backward compatibility)
        else if ((config as any).dealOfTheDayProductId) {
             const res = await getProductById((config as any).dealOfTheDayProductId);
             if (res.success && res.data) {
                 products.push({
                    ...res.data,
                    id: (res.data as any)._id || (res.data as any).id,
                    imageUrl: (res.data as any).mainImage || (res.data as any).imageUrl,
                    name: (res.data as any).productName || (res.data as any).name
                 } as any);
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

  if (dealProducts.length === 0) return null;

  return (
    <div className="px-4 md:px-6 lg:px-8 mb-6">
      <div
        className="rounded-xl p-6 md:p-8 text-center shadow-lg relative overflow-hidden flex flex-col gap-6"
        style={{
          background: `white`,
          border: '1px solid #fed7aa' // faint orange border
        }}
      >
          {/* Header */}
          <div className="flex justify-between items-center z-10 text-left border-b border-orange-100 pb-4">
              <div>
                  <h3 className="text-2xl font-bold text-gray-800">Deal of the Day</h3>
                  <p className="text-sm text-gray-500 mt-1">Grab the best prices before they reset!</p>
              </div>
              <button onClick={() => navigate('/deal-of-the-day')} className="text-sm font-semibold text-[#E65100] flex items-center gap-1 hover:text-orange-800 transition-colors">
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
                  const { displayPrice, mrp, discount } = calculateProductPrice(product);
                  return (
                      <div
                         key={product.id}
                         className="flex-none w-full md:w-[48%] lg:w-[40%] xl:w-[30%] snap-center bg-white rounded-xl p-6 shadow-md border border-gray-100 flex flex-col items-center gap-4 cursor-pointer hover:shadow-xl transition-shadow relative"
                         onClick={() => navigate(`/product/${product.id}`)}
                      >
                         <div className="absolute top-4 right-4 bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                             Active Deal
                         </div>

                         <div className="relative w-48 h-48 flex-shrink-0 bg-transparent p-2 flex items-center justify-center">
                             {discount > 0 && (
                                <span className="absolute -top-1 -left-1 bg-[#E65100] text-white text-sm font-bold px-3 py-1 rounded-full shadow-sm z-10">
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
                                 <span className="text-3xl font-bold text-[#E65100]">₹{displayPrice}</span>
                                 {mrp > displayPrice && (
                                    <span className="text-sm text-gray-400 line-through">₹{mrp}</span>
                                 )}
                             </div>
                             <button className="mt-4 w-full bg-[#E65100] hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
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
                     <div key={i} className={`w-2 h-2 rounded-full transition-colors bg-gray-300`} />
                 ))}
             </div>
          )}
      </div>
    </div>
  );
}
