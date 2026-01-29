import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeContext } from '../../context/ThemeContext';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { getVideoFinds, VideoFind, toggleLikeVideo, incrementShareCount } from '../../services/api/user/videoFindService';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

// --- Sub-components ---

const GridVideoCard = ({ product, onClick }: { product: VideoFind; onClick: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      if (video.currentTime >= 2) {
        video.currentTime = 0;
        video.play();
      }
    };
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.muted = true;
    video.play().catch(() => {});
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  return (
    <motion.div
      layoutId={`card-${product._id}`}
      onClick={onClick}
      className="bg-white rounded-xl overflow-hidden shadow-sm border border-neutral-200 cursor-pointer relative"
    >
      <div className="relative aspect-[3/4] bg-gray-100">
        <video
          ref={videoRef}
          src={product.videoUrl}
          className="w-full h-full object-cover"
          muted
          playsInline
          loop
        />
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-white text-[10px] font-medium flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {product.views}
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-800 line-clamp-1 mb-1">{product.title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">₹{product.price}</span>
          {product.originalPrice > product.price && (
            <span className="text-xs text-gray-400 line-through">₹{product.originalPrice}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const ReelItem = ({
  product,
  isActive,
  isMuted,
  toggleMute,
  setIsMuted, // New prop
  isSidePreview = false // New prop
}: {
  product: VideoFind;
  isActive: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  setIsMuted: (muted: boolean) => void;
  isSidePreview?: boolean;
}) => {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { addToCart } = useCart();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [sharesCount, setSharesCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (product.likes) {
      setLikesCount(product.likes.length);
      if (user && product.likes.includes(user.userId || user.id)) {
        setIsLiked(true);
      } else {
        setIsLiked(false);
      }
    }
    if (product.shares !== undefined) {
      setSharesCount(product.shares);
    }
  }, [product, user]);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isActive, product._id, setIsMuted]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  const togglePlay = () => {
    if (isSidePreview) return; // Disable play toggle on side previews
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(product.videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${product.title.replace(/\s+/g, '_')}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Download failed', e);
      // Fallback for cross-origin or other errors
      window.open(product.videoUrl, '_blank');
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      showToast('Please login to like videos', 'error');
      return;
    }

    try {
      const response = await toggleLikeVideo(product._id);
      if (response.success) {
        setIsLiked(response.isLiked);
        setLikesCount(response.data.likes.length);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      showToast('Failed to update like', 'error');
    }
  };

  const handleShare = async () => {
    // Increment share count on backend
    try {
      const response = await incrementShareCount(product._id);
      if (response.success) {
        setSharesCount(response.data.shares);
      }
    } catch (err) {
      console.error('Error incrementing share count:', err);
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: `Check out ${product.title} on Geeta!`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Link copied to clipboard!', 'success');
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
      e.stopPropagation();

      if (!product.linkedProduct) {
          showToast('Product not linked to this video', 'error');
          return;
      }

      if (product.linkedProduct.stock !== undefined && product.linkedProduct.stock < 1) {
           showToast('Product is out of stock', 'error');
           return;
      }

      const productToAdd: any = {
          id: product.linkedProduct._id,
          _id: product.linkedProduct._id,
          name: product.linkedProduct.productName,
          price: product.linkedProduct.price,
          imageUrl: product.linkedProduct.mainImage,
          stock: product.linkedProduct.stock,
          categoryId: '', // Not strictly needed for add to cart basic flow
          pack: '1 unit', // Default
          productName: product.linkedProduct.productName // Compatibility
      };

      await addToCart(productToAdd, e.currentTarget as HTMLElement, {
          source: 'VIDEO_FIND',
          sourceId: product._id
      });
      showToast('Added to cart!', 'success');
  };

  return (
    <div
      className={`h-full w-full relative snap-start shrink-0 cursor-pointer ${isSidePreview ? 'pointer-events-none' : ''}`}
      onClick={togglePlay}
    >
      {/* Video Layer */}
      <video
        ref={videoRef}
        src={product.videoUrl}
        className="h-full w-full object-cover"
        playsInline
        loop
        muted={isMuted}
      />
      {/* Play Icon Overlay - Only for main view */}
      {!isPlaying && !isSidePreview && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="bg-black/30 p-5 rounded-full backdrop-blur-sm shadow-lg">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinejoin="round">
               <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      )}

      {/* Dark Overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none" />

      {/* Hide UI elements if it's a side preview */}
      {!isSidePreview && (
        <>
          {/* Header Branding */}
          <div className="absolute top-0 left-0 right-0 p-4 pt-12 flex justify-center items-center z-10 pointer-events-none">
             <span className="text-white font-bold text-xl drop-shadow-md tracking-wide">Geeta</span>
          </div>

           {/* Sound Toggle */}
           <button
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            className="absolute top-12 right-4 z-20 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/30 transition-colors"
          >
            {isMuted ? (
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/></svg>
            ) : (
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            )}
          </button>

          {/* Right Side Actions - Moved UP to allow space for product card */}
          <div className="absolute bottom-52 right-4 flex flex-col gap-6 z-20 items-center">
            {/* Download */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                className="p-2.5 rounded-full bg-black/20 backdrop-blur-md text-white active:scale-90 transition-transform hover:bg-black/30"
              >
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              </button>
              <span className="text-xs text-white drop-shadow font-medium">Save</span>
            </div>

            {/* Like */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleLike(); }}
                className="p-2.5 rounded-full bg-black/20 backdrop-blur-md active:scale-90 transition-transform hover:bg-black/30"
              >
                 <svg
                   width="24" height="24" viewBox="0 0 24 24"
                   fill={isLiked ? "#ef4444" : "none"}
                   stroke={isLiked ? "#ef4444" : "white"}
                   strokeWidth="2"
                 >
                   <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                 </svg>
              </button>
              <span className="text-xs text-white drop-shadow font-medium">{likesCount}</span>
            </div>

            {/* Share */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleShare(); }}
                className="p-2.5 rounded-full bg-black/20 backdrop-blur-md text-white active:scale-90 transition-transform hover:bg-black/30"
              >
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </button>
              <span className="text-xs text-white drop-shadow font-medium">{sharesCount}</span>
            </div>
          </div>

          {/* Bottom Product Card */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-6 left-4 right-4 z-20"
            onClick={(e) => e.stopPropagation()}
          >
             {product.linkedProduct ? (
                 <div className="bg-white rounded-xl shadow-xl overflow-hidden">
                    {/* Product Details Section */}
                    <div className="p-3 flex gap-3 items-center">
                       <div className="w-14 h-14 bg-gray-100 rounded-lg shrink-0 overflow-hidden">
                           {product.linkedProduct.mainImage ? (
                               <img src={product.linkedProduct.mainImage} alt="Product" className="w-full h-full object-cover" />
                           ) : (
                               <div className="w-full h-full bg-neutral-200 flex items-center justify-center text-xs text-gray-500 font-medium">
                                  Item
                               </div>
                           )}
                       </div>
                       <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-0.5">{product.linkedProduct.productName}</h4>
                          <div className="flex items-center gap-2">
                             <span className="text-base font-bold text-gray-900">₹{product.linkedProduct.price}</span>
                          </div>
                       </div>
                    </div>

                    {/* Full Width Button Section */}
                    <button
                      onClick={handleAddToCart}
                      disabled={product.linkedProduct.stock !== undefined && product.linkedProduct.stock < 1}
                      className="w-full py-3 bg-[#E31E24] text-white font-bold text-sm uppercase tracking-wide hover:bg-red-700 active:bg-red-800 transition-colors disabled:bg-gray-400"
                    >
                       {product.linkedProduct.stock !== undefined && product.linkedProduct.stock < 1 ? 'Out of Stock' : 'Add To Cart'}
                    </button>
                 </div>
             ) : (
                 <div className="bg-white/80 backdrop-blur rounded-xl p-4 text-center text-sm font-medium">
                     Video Promotion
                 </div>
             )}
          </motion.div>
        </>
      )}
    </div>
  );
};

// --- Main Component ---

// --- Main Component ---

export default function VideoFinds() {
  const { currentTheme } = useThemeContext();
  const [activeReelIndex, setActiveReelIndex] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(window.matchMedia("(min-width: 768px)").matches);
  const [videoList, setVideoList] = useState<VideoFind[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        const response = await getVideoFinds();
        if (response.success && response.data) {
           setVideoList(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch videos", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);


  // Validate active index when list changes
  useEffect(() => {
    if (activeReelIndex !== null && activeReelIndex >= videoList.length) {
        setActiveReelIndex(null);
    }
  }, [videoList, activeReelIndex]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  // Handle Scroll Snap Logic to update activeReelIndex
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const index = Math.round(scrollTop / clientHeight);
    if (activeReelIndex !== index && index >= 0 && index < videoList.length) {
      setActiveReelIndex(index);
    }
  };

  const nextReel = () => {
    if (activeReelIndex !== null && activeReelIndex < videoList.length - 1) {
      setActiveReelIndex(activeReelIndex + 1);
    }
  };

  const prevReel = () => {
    if (activeReelIndex !== null && activeReelIndex > 0) {
      setActiveReelIndex(activeReelIndex - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      {/* Default Grid Header */}
      <div className="bg-white shadow-sm sticky top-0 z-30 w-full">
        <div className="px-4 py-3 flex items-center gap-3">
             <h1 className="text-lg font-bold" style={{ color: currentTheme.primary[0] }}>Video Finds</h1>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {videoList.map((product, index) => (
            <GridVideoCard
              key={product.id}
              product={product}
              onClick={() => setActiveReelIndex(index)}
            />
          ))}
        </div>
      </div>

      {/* Reels Full Screen Overlay */}
      <AnimatePresence>
        {activeReelIndex !== null && (
          <div className="fixed inset-0 z-[100] flex justify-center items-center">

            {/* --- MOBILE VIEW --- */}
            {!isDesktop && (
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute inset-0 bg-black md:hidden"
            >
               {/* Close Button */}
               <button
                 onClick={() => setActiveReelIndex(null)}
                 className="absolute top-4 left-4 z-30 p-2 text-white drop-shadow-md"
               >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
               </button>

               {/* Scroll Container */}
               <div
                 ref={containerRef}
                 onScroll={handleScroll}
                 className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
                 style={{ scrollBehavior: 'smooth' }}
               >
                 {videoList.map((product, index) => (
                   <div key={product.id} className="h-full w-full snap-start">
                     {/* Only render/play active or adjacent videos for performance?
                         For 3 items, render all but control play state via props.
                     */}
                     <ReelItem
                        product={product}
                        isActive={activeReelIndex === index}
                        isMuted={isMuted}
                        toggleMute={() => setIsMuted(!isMuted)}
                        setIsMuted={setIsMuted}
                     />
                   </div>
                 ))}
               </div>
            </motion.div>
            )}

            {/* --- DESKTOP VIEW --- */}
            {isDesktop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="hidden md:flex absolute inset-0 bg-black/90 backdrop-blur-md items-center justify-center p-8"
              onClick={() => setActiveReelIndex(null)}
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveReelIndex(null)}
                className="absolute top-8 right-8 text-white hover:text-gray-300 transition-colors z-50"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>

              <div className="flex items-center justify-center gap-8 w-full max-w-6xl h-[85vh]" onClick={(e) => e.stopPropagation()}>

                {/* Left Arrow */}
                <button
                   onClick={prevReel}
                   disabled={activeReelIndex === 0}
                   className={`p-3 rounded-full bg-white text-black shadow-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all ${activeReelIndex === 0 ? 'opacity-0' : 'opacity-100'}`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>

                {/* Previous Reel Preview (Left) */}
                <div className="hidden lg:block w-[280px] h-[500px] opacity-40 scale-90 blur-[1px] pointer-events-none relative rounded-2xl overflow-hidden shrink-0">
                  {activeReelIndex > 0 && (
                     <ReelItem
                       product={videoList[activeReelIndex - 1]}
                       isActive={false}
                       isMuted={true}
                       toggleMute={() => {}}
                       setIsMuted={setIsMuted}
                       isSidePreview={true}
                     />
                  )}
                </div>

                {/* CENTER ACTIVE REEL */}
                <div className="w-[360px] h-[640px] shadow-2xl rounded-2xl overflow-hidden shrink-0 relative bg-black transform hover:scale-[1.01] transition-transform duration-300">
                   <ReelItem
                     product={videoList[activeReelIndex]}
                     isActive={true}
                     isMuted={isMuted}
                     toggleMute={() => setIsMuted(!isMuted)}
                     setIsMuted={setIsMuted}
                   />
                </div>

                 {/* Next Reel Preview (Right) */}
                 <div className="hidden lg:block w-[280px] h-[500px] opacity-40 scale-90 blur-[1px] pointer-events-none relative rounded-2xl overflow-hidden shrink-0">
                  {activeReelIndex < videoList.length - 1 && (
                     <ReelItem
                       product={videoList[activeReelIndex + 1]}
                       isActive={false}
                       isMuted={true}
                       toggleMute={() => {}}
                       setIsMuted={setIsMuted}
                       isSidePreview={true}
                     />
                  )}
                </div>

                {/* Right Arrow */}
                <button
                   onClick={nextReel}
                   disabled={activeReelIndex === videoList.length - 1}
                   className={`p-3 rounded-full bg-white text-black shadow-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all ${activeReelIndex === videoList.length - 1 ? 'opacity-0' : 'opacity-100'}`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>

              </div>
            </motion.div>
            )}

          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

