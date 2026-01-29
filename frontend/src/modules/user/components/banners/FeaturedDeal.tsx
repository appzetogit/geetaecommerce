import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTheme } from '../../../../utils/themes';
import { useThemeContext } from '../../../../context/ThemeContext';
import { getProducts, getProductById } from '../../../../services/api/customerProductService';
import { Product } from '../../../../types/domain';
import { calculateProductPrice } from '../../../../utils/priceUtils';
import { bannerService } from '../../../../services/bannerService';

export default function FeaturedDeal() {
  const navigate = useNavigate();
  const { activeCategory } = useThemeContext();
  const theme = getTheme(activeCategory || 'all');
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        const config = await bannerService.getDealsConfig();

        let products: Product[] = [];

        // Check for multiple IDs first
        if (config.featuredDealProductIds && config.featuredDealProductIds.length > 0) {
             const promises = config.featuredDealProductIds.map(id => getProductById(id));
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
                         // Only needed props
                     } as any);
                 }
             });
        }
        // Fallback logic removed as per user request to follow Deal of the Day style.
        // If no products are selected in admin, this section will not show random products.

        setFeaturedProducts(products);

      } catch (err) {
        console.error("Failed to fetch featured deals", err);
      }
    };
    fetchFeaturedProducts();
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (featuredProducts.length <= 1) return;

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
    }, 4000);

    return () => clearInterval(interval);
  }, [featuredProducts]);

  if (featuredProducts.length === 0) return null;

  return (
    <div className="px-4 md:px-6 lg:px-8 mb-6">
      <div
        className="rounded-xl p-4 md:p-6 shadow-sm relative overflow-hidden flex flex-col gap-4"
        style={{
          background: `#f0f9ff`, // Very light sky blue
          border: '1px solid #e0f2fe'
        }}
      >
          {/* Header */}
          <div className="flex justify-between items-center z-10 text-left border-b border-sky-100/50 pb-3">
              <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Featured Deals</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">See the latest deals and exciting new offers!</p>
              </div>
              <button onClick={() => navigate('/featured-deals')} className="text-xs font-bold text-sky-600 flex items-center gap-1 hover:text-sky-700 transition-colors bg-white/50 px-3 py-1.5 rounded-full border border-sky-100">
                  View All <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
          </div>

          {/* Product Grid/Carousel */}
          <div
             ref={scrollContainerRef}
             className="flex overflow-x-auto gap-4 snap-x snap-mandatory scrollbar-hide py-2"
             style={{ scrollBehavior: 'smooth' }}
          >
              {featuredProducts.map(product => {
                  const { displayPrice, mrp, discount } = calculateProductPrice(product);
                  return (
                      <div
                         key={product.id}
                         className="flex-none w-[280px] md:w-[320px] snap-center bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow relative"
                         onClick={() => navigate(`/product/${product.id}`)}
                      >
                         {/* Image with Badge */}
                         <div className="relative w-24 h-24 flex-shrink-0 bg-neutral-50 rounded-lg overflow-hidden flex items-center justify-center">
                             {discount > 0 && (
                                <span className="absolute top-0 left-0 bg-[#1e40af] text-white text-[10px] font-bold px-2 py-1 rounded-br-lg z-10">
                                    -₹{mrp - displayPrice}
                                </span>
                             )}
                             <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-contain p-1"
                             />
                         </div>

                         {/* Content */}
                         <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">
                                  {(typeof (product as any).brand === 'object' ? (product as any).brand?.name : (product as any).brand) || (product as any).category?.name || "FEATURED"}
                              </span>
                             <h4 className="font-bold text-slate-800 text-sm line-clamp-2 leading-snug">
                                 {product.name}
                             </h4>
                             <div className="flex items-center gap-2 mt-1">
                                 <span className="text-xs text-slate-400 line-through">₹{mrp}</span>
                                 <span className="text-sm font-bold text-slate-900">₹{displayPrice}</span>
                             </div>

                             {/* Decoration circle */}
                             <div className="absolute bottom-3 right-3">
                                 <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                                      <div className="w-3 h-3 rounded-full bg-slate-300 opacity-50" />
                                 </div>
                             </div>
                         </div>
                      </div>
                  );
              })}
          </div>

          {/* Dots Indicator if multiple */}
          {featuredProducts.length > 1 && (
             <div className="flex justify-center gap-2 mt-2">
                 {featuredProducts.map((_, i) => (
                     <div key={i} className={`w-2 h-2 rounded-full transition-colors bg-sky-300`} />
                 ))}
             </div>
          )}
      </div>
    </div>
  );
}
