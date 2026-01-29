import { useState, useEffect } from 'react';
import { bannerService } from '../../../../services/bannerService';
import { Banner } from '../../../../types/banner';

export default function HomePopup() {
  const [popupData, setPopupData] = useState<Banner | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const banners = await bannerService.getActiveBannersForPosition('POPUP_ON_FIRST_VISIT');
        if (banners && banners.length > 0) {
            const hasSeen = localStorage.getItem('has_seen_popup_' + banners[0].id);
            if (!hasSeen) {
                setPopupData(banners[0]);
                // Small delay to not overwhelm user immediately
                setTimeout(() => {
                    setIsOpen(true);
                }, 2000);
            }
        }
      } catch (error) {
        console.error("Failed to load popup banner", error);
      }
    };
    fetchBanners();
  }, []);

  const handleClose = () => {
    if (popupData) {
        localStorage.setItem('has_seen_popup_' + popupData.id, 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen || !popupData) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleClose}
      ></div>
      <div className="relative bg-white rounded-2xl overflow-hidden max-w-md w-full shadow-2xl transform transition-all duration-300 scale-100 animate-in zoom-in-95">
         <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 p-2 bg-white/80 rounded-full hover:bg-white text-gray-800 transition-colors shadow-sm"
         >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
         </button>

         <div className="relative h-64 sm:h-72 bg-gray-100">
            <img
                src={popupData.image}
                alt={popupData.title}
                className="w-full h-full object-cover"
            />
            {/* Gradient overlay for text legibility if needed */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
         </div>

         <div className="p-6 text-center relative -mt-6 bg-white rounded-t-3xl">
             <h3 className="text-2xl font-bold text-gray-900 mb-2">
                 {typeof popupData.title === 'string' ? popupData.title : (popupData as any).resourceName || 'Special Offer'}
             </h3>
             <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                 {typeof popupData.subtitle === 'string' ? popupData.subtitle : ''}
             </p>
             <button
                onClick={handleClose}
                className="w-full py-3.5 bg-black text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-transform active:scale-95 shadow-lg"
             >
                Start Shopping
             </button>
         </div>
      </div>
    </div>
  );
}
