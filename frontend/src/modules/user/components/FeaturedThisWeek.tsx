import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getProducts } from '../../../services/api/customerProductService';

interface FeaturedCard {
  id: string;
  type: 'newly-launched' | 'price-drop' | 'plum-cakes' | 'featured';
  title?: string;
  categoryId?: string;
  bgColor: string;
  borderColor: string;
}

const featuredCards: FeaturedCard[] = [
  {
    id: 'newly-launched',
    type: 'newly-launched',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  {
    id: 'price-drop',
    type: 'price-drop',
    title: 'PRICE DROP',
    bgColor: 'bg-blue-900',
    borderColor: 'border-blue-500',
  },
  {
    id: 'plum-cakes',
    type: 'plum-cakes',
    title: 'Plum Cakes',
    bgColor: 'bg-red-900',
    borderColor: 'border-white',
  },
  {
    id: 'fresh-arrivals',
    type: 'featured',
    title: 'Fresh Arrivals',
    categoryId: 'fruits-veg',
    bgColor: 'bg-green-600',
    borderColor: 'border-green-400',
  },
];

export default function FeaturedThisWeek() {
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [newlyLaunchedProducts, setNewlyLaunchedProducts] = useState<any[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await getProducts({ limit: 6 });
        if (res.success && res.data) {
          setNewlyLaunchedProducts(res.data);
        }
      } catch (e) {
        console.error(e);
        const fruitList = [
          { id: '1', name: 'Papaya', emoji: '🥭' },
          { id: '2', name: 'Apple', emoji: '🍎' },
          { id: '3', name: 'Banana', emoji: '🍌' },
          { id: '4', name: 'Mango', emoji: '🥭' },
          { id: '5', name: 'Orange', emoji: '🍊' },
          { id: '6', name: 'Guava', emoji: '🍈' },
        ];
        setNewlyLaunchedProducts(fruitList);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (newlyLaunchedProducts.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentProductIndex((prev) => (prev + 1) % newlyLaunchedProducts.length);
      }, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [newlyLaunchedProducts.length]);

  return (
    <div className="mb-6 mt-6">
      <h2 className="text-lg font-semibold text-neutral-900 mb-3 px-4 tracking-tight">
        Featured this week
      </h2>
      <div className="px-4">
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 scroll-smooth">
          <div className="flex-shrink-0 w-[110px]">
            <div className="bg-gradient-to-br from-yellow-50 via-yellow-100 to-yellow-50 border-2 border-yellow-300 rounded-2xl overflow-hidden relative h-48 shadow-lg hover:shadow-xl transition-shadow">
              <div className="absolute top-0 left-0 right-0 z-20">
                <div className="bg-gradient-to-r from-red-600 via-orange-500 to-red-600 rounded-b-3xl px-3 py-2 text-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                  <div className="text-white text-[9px] font-black uppercase leading-tight tracking-wider relative z-10">
                    <div>NEWLY</div>
                    <div>LAUNCHED</div>
                  </div>
                </div>
              </div>
              <div className="absolute top-12 right-2 w-8 h-8 bg-yellow-200/30 rounded-full blur-sm"></div>
              <div className="absolute bottom-16 left-2 w-6 h-6 bg-orange-200/30 rounded-full blur-sm"></div>
              <div className="relative h-32 mt-10 overflow-hidden bg-yellow-50">
                {newlyLaunchedProducts.map((product, idx) => (
                  <div
                    key={`${product.id || idx}-${product.imageUrl || product.name}`}
                    className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${idx === currentProductIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name || 'Product'}
                        className="w-full h-full object-contain p-2 drop-shadow-lg"
                      />
                    ) : (
                      <div className="text-5xl drop-shadow-md">
                        {('emoji' in product && product.emoji) || '🍎'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
                <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-amber-700 px-3 py-1 rounded-full flex items-center gap-1 shadow-lg border border-amber-900/30">
                  <div className="w-1 h-1 bg-white rounded-sm rotate-45 shadow-sm"></div>
                  <span className="text-white text-[8px] font-black tracking-wide">For You</span>
                  <div className="w-1 h-1 bg-white rounded-sm rotate-45 shadow-sm"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 w-[110px]">
            <Link
              to="/category/snacks"
              className="block bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 border-2 border-blue-400 rounded-2xl overflow-hidden relative h-48 shadow-lg hover:shadow-xl transition-shadow group"
            >
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_white_1px,_transparent_1px)] bg-[length:20px_20px]"></div>
              </div>
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
                <div className="bg-gradient-to-r from-red-500 to-red-600 px-3 py-1 rounded-full shadow-lg border border-red-400/50">
                  <span className="text-white text-[9px] font-black tracking-wide">Featured</span>
                </div>
              </div>
              <div className="absolute top-8 right-3 w-12 h-12 bg-yellow-400/20 rounded-full blur-md"></div>
              <div className="absolute bottom-8 left-3 w-10 h-10 bg-red-500/20 rounded-full blur-md"></div>
              <div className="flex items-center justify-center h-full px-2 relative z-10">
                <div className="text-center">
                  <div
                    className="text-yellow-400 text-3xl font-black mb-0.5 transform group-hover:scale-105 transition-transform"
                    style={{
                      textShadow: '2px 2px 0px #1e3a8a, 3px 3px 6px rgba(0,0,0,0.3)',
                      letterSpacing: '2px'
                    }}
                  >
                    PRICE
                  </div>
                  <div
                    className="text-red-400 text-3xl font-black transform group-hover:scale-105 transition-transform"
                    style={{
                      textShadow: '2px 2px 0px #1e3a8a, 3px 3px 6px rgba(0,0,0,0.3)',
                      letterSpacing: '2px'
                    }}
                  >
                    DROP
                  </div>
                </div>
              </div>
            </Link>
          </div>

          <div className="flex-shrink-0 w-[110px]">
            <Link
              to="/category/biscuits-bakery"
              className="block bg-gradient-to-br from-red-900 via-red-800 to-red-900 border-2 border-white/30 rounded-2xl overflow-hidden relative h-48 shadow-lg hover:shadow-xl transition-shadow group"
            >
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,_transparent_25%,_white_25%,_white_50%,_transparent_50%,_transparent_75%,_white_75%,_white)] bg-[length:20px_20px]"></div>
              </div>
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
                <div className="bg-gradient-to-r from-red-500 to-red-600 px-3 py-1 rounded-full shadow-lg border border-red-400/50">
                  <span className="text-white text-[9px] font-black tracking-wide">Featured</span>
                </div>
              </div>
              <div className="absolute top-8 left-0 right-0 z-20 text-center px-2">
                <h3 className="text-white text-sm font-black tracking-wide drop-shadow-lg" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                  Plum Cakes
                </h3>
              </div>
              <div className="absolute top-14 right-2 w-6 h-6 bg-white/10 rounded-full blur-sm"></div>
              <div className="absolute bottom-10 left-2 w-5 h-5 bg-amber-300/20 rounded-full blur-sm"></div>
              <div className="flex items-center justify-center h-full pt-12 relative z-10">
                <div className="text-5xl transform group-hover:scale-110 transition-transform drop-shadow-2xl">
                  🎂
                </div>
              </div>
            </Link>
          </div>

          <div className="flex-shrink-0 w-[110px]">
            <Link
              to="/category/fruits-veg"
              className="block bg-gradient-to-br from-green-600 via-green-500 to-green-600 border-2 border-green-400 rounded-2xl overflow-hidden relative h-48 shadow-lg hover:shadow-xl transition-shadow group"
            >
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_white_2px,_transparent_2px)] bg-[length:30px_30px]"></div>
              </div>
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
                <div className="bg-gradient-to-r from-green-700 to-green-600 px-3 py-1 rounded-full shadow-lg border border-green-400/50">
                  <span className="text-white text-[9px] font-black tracking-wide">Featured</span>
                </div>
              </div>
              <div className="absolute top-8 left-0 right-0 z-20 text-center px-2">
                <h3 className="text-white text-sm font-black tracking-wide drop-shadow-lg" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                  Fresh Arrivals
                </h3>
              </div>
              <div className="absolute top-14 right-2 w-8 h-8 bg-white/20 rounded-full blur-md"></div>
              <div className="absolute bottom-10 left-2 w-6 h-6 bg-yellow-300/30 rounded-full blur-md"></div>
              <div className="flex items-center justify-center h-full pt-12 relative z-10 gap-1.5">
                <div className="text-3xl transform group-hover:scale-110 transition-transform">🍎</div>
                <div className="text-3xl transform group-hover:scale-110 transition-transform">🍌</div>
                <div className="text-3xl transform group-hover:scale-110 transition-transform">🍊</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
