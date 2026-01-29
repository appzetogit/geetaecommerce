import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTheme } from '../../../../utils/themes';
import { useThemeContext } from '../../../../context/ThemeContext';
import { bannerService } from '../../../../services/bannerService';
import { getProductById, getProducts } from '../../../../services/api/customerProductService';
import { calculateProductPrice } from '../../../../utils/priceUtils';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function FlashDealSection() {
  const navigate = useNavigate();
  const { activeCategory } = useThemeContext();
  const theme = getTheme(activeCategory || 'all');
  const [config, setConfig] = useState<{flashDealTargetDate: string; flashDealImage?: string; isActive?: boolean; flashDealProductIds?: string[]}>({ flashDealTargetDate: '', isActive: true });
  const [products, setProducts] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchConfig = async () => {
        try {
            const data = await bannerService.getDealsConfig();
            setConfig(data);

            let fetchedProducts: any[] = [];

            // 1. Try to fetch from specific IDs if configured
            if (data.flashDealProductIds && data.flashDealProductIds.length > 0) {
                const promises = data.flashDealProductIds.slice(0, 10).map(id => getProductById(id));
                const results = await Promise.all(promises);
                fetchedProducts = results
                    .filter(res => res.success && res.data)
                    .map(res => ({
                        ...res.data,
                        id: (res.data as any)._id || (res.data as any).id
                    }));
            }

            setProducts(fetchedProducts);
            setIsLoaded(true);
        } catch (error) {
            console.error("Error fetching deals config:", error);
            setIsLoaded(true);
        }
    };
    fetchConfig();
  }, [activeCategory]);

  const [targetDate, setTargetDate] = useState(() => {
      const date = new Date();
      date.setHours(date.getHours() + 24);
      return date;
  });

  useEffect(() => {
     if (config.flashDealTargetDate) {
         const serverDate = new Date(config.flashDealTargetDate);
         // If server date is in the past, add 24 hours to the current time to make it "run"
         if (serverDate.getTime() <= Date.now()) {
            const newTarget = new Date();
            newTarget.setHours(newTarget.getHours() + 24);
            setTargetDate(newTarget);
         } else {
            setTargetDate(serverDate);
         }
     }
  }, [config.flashDealTargetDate]);

  const calculateTimeLeft = (): TimeLeft => {
    const difference = +targetDate - +new Date();
    let timeLeft: TimeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }
    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  // Only hide if EXPLICITLY set to inactive by admin.
  if (isLoaded && config.isActive === false) {
    return null;
  }

  const TimerBox = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center min-w-[32px] md:min-w-[36px]">
      <div className="text-white font-bold text-lg md:text-xl leading-none mb-1">
        {value.toString().padStart(2, '0')}
      </div>
      <span className="text-[10px] text-white/70 uppercase tracking-tighter font-medium">{label}</span>
    </div>
  );

  return (
    <div className="px-4 md:px-6 lg:px-8 mb-8 mt-4">
      <div className="rounded-2xl shadow-sm border border-neutral-100 overflow-hidden flex flex-col md:flex-row md:items-stretch">

        {/* LEFT SIDE (Desktop Sidebar / Mobile Header) */}
        <div
            className="relative p-5 md:p-8 md:w-[280px] lg:w-[320px] flex flex-col justify-center flex-shrink-0"
        >
             {/* Desktop Background Layer */}
             <div
                className="absolute inset-0 hidden md:block"
                style={{ background: `linear-gradient(135deg, ${theme.primary[0]} 0%, ${theme.primary[1]} 100%)` }}
             />

             {/* Mobile Background Layer */}
             <div
                className="absolute inset-0 md:hidden"
                style={{ background: `linear-gradient(135deg, ${theme.primary[3]}33 0%, #fff 100%)` }}
             />

             <div className="relative z-10 flex flex-col h-full md:justify-center">
                {/* Header Text */}
                <div className="flex flex-col items-center md:items-start text-center md:text-left mb-6 md:mb-8">
                    {/* Mobile Title */}
                    <h2 className="md:hidden text-xl font-black tracking-tight" style={{ color: theme.primary[0] }}>FLASH DEAL</h2>
                    {/* Desktop Title */}
                    <h2 className="hidden md:block text-3xl lg:text-4xl font-black tracking-tight text-white mb-2">FLASH DEAL</h2>

                    <p className="text-neutral-500 text-xs md:text-white/90 md:text-sm mt-1 max-w-xs font-medium">
                        Hurry Up! The offer is limited. Grab while it lasts
                    </p>
                </div>

                {/* Timer */}
                <div className="w-full flex justify-center md:justify-start">
                    <div
                        className="relative flex items-center gap-1 md:gap-1.5 p-3 rounded-xl shadow-lg z-10 md:w-full md:justify-center md:py-4 md:shadow-none md:bg-white/20 md:backdrop-blur-sm"
                    >
                        {/* Mobile Timer BG */}
                        <div className="absolute inset-0 rounded-xl md:hidden" style={{ backgroundColor: theme.primary[0] }} />

                        <div className="relative z-10 flex items-center gap-1 md:gap-1.5">
                            <TimerBox value={timeLeft.days} label="Days" />
                            <span className="text-white/50 font-bold text-lg mb-1">:</span>
                            <TimerBox value={timeLeft.hours} label="Hrs" />
                            <span className="text-white/50 font-bold text-lg mb-1">:</span>
                            <TimerBox value={timeLeft.minutes} label="Min" />
                            <span className="text-white/50 font-bold text-lg mb-1">:</span>
                            <TimerBox value={timeLeft.seconds} label="Sec" />
                        </div>
                    </div>
                </div>

                {/* Desktop View All Button */}
                <div className="hidden md:block mt-8">
                    <button
                        onClick={() => navigate('/flash-deals')}
                        className="w-full py-3 bg-white hover:bg-white/90 text-sm font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                        style={{ color: theme.primary[0] }}
                    >
                        View All Deals
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </button>
                </div>
             </div>
        </div>

        {/* RIGHT SIDE (Products) */}
        <div className="p-5 pt-0 md:p-6 md:flex-1 bg-white md:bg-neutral-50/30">
            {products.length > 0 ? (
                <div
                    ref={scrollContainerRef}
                    className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-4 md:overflow-visible h-full content-start"
                >
                    {products.map(product => {
                        const { displayPrice, mrp, discount } = calculateProductPrice(product);
                        return (
                            <div
                                key={product.id}
                                className="flex-none w-[260px] md:w-auto bg-white rounded-xl p-3 shadow-md border border-neutral-100 flex md:flex-col items-center gap-3 cursor-pointer hover:scale-[1.02] transition-transform h-full"
                                onClick={() => navigate(`/product/${product.id}`)}
                            >
                                <div className="relative w-20 h-20 md:w-full md:h-40 flex-shrink-0 bg-neutral-50 rounded-lg overflow-hidden flex items-center justify-center">
                                    {discount > 0 && (
                                        <div
                                            className="absolute top-0 left-0 text-white text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-br-lg z-10"
                                            style={{ backgroundColor: theme.primary[0] }}
                                        >
                                            -{discount}%
                                        </div>
                                    )}
                                    <img
                                        src={product.mainImage || product.imageUrl}
                                        alt={product.name}
                                        className="w-full h-full object-contain p-1"
                                    />
                                </div>
                                <div className="flex-1 min-w-0 md:w-full md:text-left">
                                    <h4 className="font-bold text-neutral-800 text-sm line-clamp-2 leading-snug mb-1 md:text-base md:mb-2">
                                        {product.productName || product.name || 'Product'}
                                    </h4>
                                    <div className="flex flex-col md:flex-row md:items-center md:gap-2 mt-1">
                                        <div className="flex flex-col md:flex-row md:items-baseline md:gap-2">
                                            <span className="text-sm md:text-lg font-black text-neutral-900">₹{displayPrice}</span>
                                            {mrp > displayPrice && (
                                                <span className="text-[10px] md:text-xs text-neutral-400 line-through">₹{mrp}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex items-center justify-center h-full p-8 bg-neutral-50/50 rounded-xl border border-dashed border-neutral-200">
                    <p className="text-neutral-400 text-sm font-medium italic">Setting up products for your flash deal...</p>
                </div>
            )}
        </div>

        {/* Mobile Footer Action */}
        <div className="flex justify-center border-t border-neutral-100 pt-4 pb-4 md:hidden">
            <button
                onClick={() => navigate('/flash-deals')}
                className="text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all px-6 py-2 rounded-full border border-neutral-200 bg-white"
                style={{ color: theme.primary[0] }}
            >
                View All <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
        </div>
      </div>
    </div>
  );
}
