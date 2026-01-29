import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import FloatingCartPill from './FloatingCartPill';
import { useLocation as useLocationContext } from '../hooks/useLocation';
import LocationPermissionRequest from './LocationPermissionRequest';
import { useThemeContext } from '../context/ThemeContext';
import QRScannerModal from './QRScannerModal';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [categoriesRotation, setCategoriesRotation] = useState(0);
  const [prevCategoriesActive, setPrevCategoriesActive] = useState(false);
  const { isLocationEnabled, isLocationLoading, location: userLocation } = useLocationContext();
  const [showLocationRequest, setShowLocationRequest] = useState(false);
  const [showLocationChangeModal, setShowLocationChangeModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const { currentTheme } = useThemeContext();

  const isActive = (path: string) => location.pathname === path;

  // Check if location is required for current route
  const requiresLocation = () => {
    const publicRoutes = ['/login', '/signup', '/seller/login', '/seller/signup', '/delivery/login', '/delivery/signup', '/admin/login'];
    // Don't require location on login/signup pages
    if (publicRoutes.includes(location.pathname)) {
      return false;
    }
    // Require location for ALL routes (not just authenticated users)
    // This ensures location is mandatory for everyone visiting the platform
    return true;
  };

  // ALWAYS show location request modal on app load if location is not enabled
  // This ensures modal appears on every app open, regardless of browser permission state
  useEffect(() => {
    // Wait for initial loading to complete
    if (isLocationLoading) {
      return;
    }

    // If location is enabled, hide modal
    if (isLocationEnabled) {
      setShowLocationRequest(false);
      return;
    }

    // If location is NOT enabled and route requires location, ALWAYS show modal
    // This will trigger on every app open until user explicitly confirms location
    if (!isLocationEnabled && requiresLocation()) {
      setShowLocationRequest(true);
    } else {
      setShowLocationRequest(false);
    }
  }, [isLocationLoading, isLocationEnabled, location.pathname]);

  // Update search query when URL params change
  useEffect(() => {
    const query = searchParams.get('q') || '';
    setSearchQuery(query);
  }, [searchParams]);

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (location.pathname === '/search') {
      // Update URL params when on search page
      if (value.trim()) {
        setSearchParams({ q: value });
      } else {
        setSearchParams({});
      }
    } else {
      // Navigate to search page with query
      if (value.trim()) {
        navigate(`/search?q=${encodeURIComponent(value)}`);
      }
    }
  };




  // Reset scroll position when navigating to any page (smooth, no flash)
  useEffect(() => {
    // Use requestAnimationFrame to prevent visual flash
    requestAnimationFrame(() => {
      if (mainRef.current) {
        mainRef.current.scrollTop = 0;
      }
      // Also reset window scroll smoothly
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
  }, [location.pathname]);

  // Track categories active state for rotation
  const isCategoriesActive = isActive('/categories') || location.pathname.startsWith('/category/');

  useEffect(() => {
    if (isCategoriesActive && !prevCategoriesActive) {
      // Rotate clockwise when clicked (becoming active)
      setCategoriesRotation(prev => prev + 360);
      setPrevCategoriesActive(true);
    } else if (!isCategoriesActive && prevCategoriesActive) {
      // Rotate counter-clockwise when unclicked (becoming inactive)
      setCategoriesRotation(prev => prev - 360);
      setPrevCategoriesActive(false);
    }
  }, [isCategoriesActive, prevCategoriesActive]);

  const isProductDetailPage = location.pathname.startsWith('/product/');
  const isSearchPage = location.pathname === '/search';
  const isCheckoutPage = location.pathname === '/checkout' || location.pathname.startsWith('/checkout/');
  const isCartPage = location.pathname === '/cart';
  const showHeader = isSearchPage && !isCheckoutPage && !isCartPage;
  const showSearchBar = isSearchPage && !isCheckoutPage && !isCartPage;
  const showFooter = !isCheckoutPage && !isProductDetailPage;

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden">
      {/* Desktop Container Wrapper */}
      <div className="md:w-full md:bg-white md:min-h-screen overflow-x-hidden">
        <div className="md:w-full md:min-h-screen md:flex md:flex-col overflow-x-hidden">
          {/* Top Navigation Bar - Desktop Only */}
          {showFooter && (
            <nav
              className="hidden md:flex items-center justify-center gap-8 px-6 lg:px-8 py-3 shadow-sm transition-colors duration-300"
              style={{
                background: `linear-gradient(to right, ${currentTheme.primary[0]}, ${currentTheme.primary[1]})`,
                borderBottom: `1px solid ${currentTheme.primary[0]}`
              }}
            >
              {/* Home */}
              <Link
                to="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/')
                  ? 'bg-white shadow-md font-semibold'
                  : 'hover:bg-white/20'
                  }`}
                style={{
                  color: isActive('/') ? currentTheme.accentColor : currentTheme.headerTextColor
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {isActive('/') ? (
                    <>
                      <path d="M2 12L12 4L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" />
                      <rect x="4" y="12" width="16" height="8" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </>
                  ) : (
                    <>
                      <path d="M2 12L12 4L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      <rect x="4" y="12" width="16" height="8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
                    </>
                  )}
                </svg>
                <span className="font-medium text-sm">Home</span>
              </Link>

              {/* Order Again */}
              <Link
                to="/order-again"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/order-again')
                  ? 'bg-white shadow-md font-semibold'
                  : 'hover:bg-white/20'
                  }`}
                style={{
                  color: isActive('/order-again') ? currentTheme.accentColor : currentTheme.headerTextColor
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {isActive('/order-again') ? (
                    <path d="M5 8V6C5 4.34315 6.34315 3 8 3H16C17.6569 3 19 4.34315 19 6V8H21C21.5523 8 22 8.44772 22 9V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V9C2 8.44772 2.44772 8 3 8H5Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  ) : (
                    <path d="M5 8V6C5 4.34315 6.34315 3 8 3H16C17.6569 3 19 4.34315 19 6V8H21C21.5523 8 22 8.44772 22 9V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V9C2 8.44772 2.44772 8 3 8H5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
                  )}
                </svg>
                <span className="font-medium text-sm">Order Again</span>
              </Link>

              {/* Brands */}
              <Link
                to="/brands"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/brands')
                  ? 'bg-white shadow-md font-semibold'
                  : 'hover:bg-white/20'
                  }`}
                style={{
                  color: isActive('/brands') ? currentTheme.accentColor : currentTheme.headerTextColor
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {isActive('/brands') ? (
                    <>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  ) : (
                    <>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
                      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}
                </svg>
                <span className="font-medium text-sm">Brand</span>
              </Link>



              {/* Video Finds */}
              <Link
                to="/video-finds"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/video-finds')
                  ? 'bg-white shadow-md font-semibold'
                  : 'hover:bg-white/20'
                  }`}
                style={{
                  color: isActive('/video-finds') ? currentTheme.accentColor : currentTheme.headerTextColor
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {isActive('/video-finds') ? (
                    <>
                      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="currentColor" />
                      <path d="M10 9l5 3-5 3V9z" fill="white" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                    </>
                  ) : (
                    <>
                      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                      <path d="M10 9l5 3-5 3V9z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </>
                  )}
                </svg>
                <span className="font-medium text-sm">Video Finds</span>
              </Link>

              {/* Categories */}
              <Link
                to="/categories"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${(isActive('/categories') || location.pathname.startsWith('/category/'))
                  ? 'bg-white shadow-md font-semibold'
                  : 'hover:bg-white/20'
                  }`}
                style={{
                  color: (isActive('/categories') || location.pathname.startsWith('/category/')) ? currentTheme.accentColor : currentTheme.headerTextColor
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {(isActive('/categories') || location.pathname.startsWith('/category/')) ? (
                    <>
                      <circle cx="7" cy="7" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                      <circle cx="17" cy="7" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                      <circle cx="7" cy="17" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                      <circle cx="17" cy="17" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                    </>
                  ) : (
                    <>
                      <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
                      <circle cx="17" cy="7" r="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
                      <circle cx="7" cy="17" r="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
                      <circle cx="17" cy="17" r="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
                    </>
                  )}
                </svg>
                <span className="font-medium text-sm">Categories</span>
              </Link>

              {/* Profile */}
              <Link
                to="/account"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/account')
                  ? 'bg-white shadow-md font-semibold'
                  : 'hover:bg-white/20'
                  }`}
                style={{
                  color: isActive('/account') ? currentTheme.accentColor : currentTheme.headerTextColor
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {isActive('/account') ? (
                    <>
                      <circle cx="12" cy="8" r="4" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="currentColor" />
                    </>
                  ) : (
                    <>
                      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
                      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                    </>
                  )}
                </svg>
                <span className="font-medium text-sm">Profile</span>
              </Link>
            </nav>
          )}

          {/* Sticky Header - Show on search page and other non-home pages, excluding account page */}
          {(showHeader || isSearchPage) && (
            <header className="sticky top-0 z-50 bg-white shadow-sm md:shadow-md md:top-[60px]">
              {/* Delivery info line */}
              <div className="px-4 md:px-6 lg:px-8 py-1.5 bg-green-50 text-xs text-green-700 text-center">
                Delivering in 10–15 mins
              </div>

              {/* Location line - only show if user has provided location */}
              {userLocation && (userLocation.address || userLocation.city) && (
              <div className="px-4 md:px-6 lg:px-8 py-2 flex items-center justify-between text-sm">
                  <span className="text-neutral-700 line-clamp-1" title={userLocation?.address || ''}>
                  {userLocation?.address
                    ? userLocation.address.length > 50
                      ? `${userLocation.address.substring(0, 50)}...`
                      : userLocation.address
                    : userLocation?.city && userLocation?.state
                      ? `${userLocation.city}, ${userLocation.state}`
                        : userLocation?.city || ''}
                </span>
                <button
                  onClick={() => setShowLocationChangeModal(true)}
                  className="text-blue-600 font-medium hover:text-blue-700 transition-colors flex-shrink-0 ml-2"
                >
                  Change
                </button>
              </div>
              )}

              {/* Search bar - Hidden on Order Again page */}
              {showSearchBar && (
                <div className="px-4 md:px-6 lg:px-8 pb-3">
                  <div className="relative max-w-2xl md:mx-auto flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search for products..."
                        className="w-full px-4 py-2.5 pl-10 bg-neutral-50 border border-neutral-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent md:py-3"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">🔍</span>
                    </div>

                    {/* Scanner Button */}
                    <button
                        onClick={() => setShowScanner(true)}
                        className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 p-2.5 rounded-lg border border-neutral-200 transition-colors flex items-center justify-center"
                        title="Scan Barcode"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                            <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                            <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                            <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                            <rect x="7" y="7" width="10" height="10" rx="1"></rect>
                            <path d="M12 12h.01"></path>
                        </svg>
                    </button>
                  </div>
                </div>
              )}
            </header>
          )}

          {/* Scanner Modal */}
          {showScanner && (
            <QRScannerModal
                onScanSuccess={(decodedText) => {
                    setShowScanner(false);
                    if (decodedText) {
                        handleSearchChange(decodedText);
                    }
                }}
                onClose={() => setShowScanner(false)}
            />
          )}

          {/* Scrollable Main Content */}
          <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide pb-24 md:pb-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.2,
                  ease: "easeInOut"
                }}
                className="w-full max-w-full"
                style={{ minHeight: '100%' }}
                onAnimationComplete={() => {
                  if (mainRef.current) {
                    mainRef.current.scrollTop = 0;
                  }
                  window.scrollTo(0, 0);
                }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Floating Cart Pill */}
          <FloatingCartPill />

          {/* Location Permission Request Modal - Mandatory for all users */}
          {showLocationRequest && (
            <LocationPermissionRequest
              onLocationGranted={() => setShowLocationRequest(false)}
              skipable={false}
              title="Location Access Required"
              description="We need your location to show you products available near you and enable delivery services. Location access is required to continue."
            />
          )}

          {/* Location Change Modal */}
          {showLocationChangeModal && (
            <LocationPermissionRequest
              onLocationGranted={() => setShowLocationChangeModal(false)}
              skipable={true}
              title="Change Location"
              description="Update your location to see products available near you."
            />
          )}

          {/* Fixed Bottom Navigation - Mobile Only, Hidden on checkout pages */}
          {showFooter && (
            <nav
              className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200/10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] z-50 md:hidden"
            >
              <div className="flex justify-around items-center h-16">
                {/* Home */}
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="flex-1 h-full"
                >
                  <Link
                    to="/"
                    className="flex flex-col items-center justify-center h-full relative"
                  >
                    <div className="flex flex-col items-center justify-center relative z-10">
                      <motion.svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        animate={isActive('/') ? {
                          scale: [1, 1.1, 1],
                          y: [0, -2, 0]
                        } : {}}
                        transition={{
                          duration: 0.4,
                          ease: "easeInOut",
                          repeat: isActive('/') ? Infinity : 0,
                          repeatDelay: 2
                        }}
                      >
                        {isActive('/') ? (
                          <>
                            {/* Roof */}
                            <path d="M2 12L12 4L22 12" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="#22c55e" />
                            {/* House body */}
                            <rect x="4" y="12" width="16" height="8" fill="#22c55e" stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" />
                            {/* Chimney */}
                            <rect x="15" y="5" width="4" height="5" fill="#1f2937" stroke="#1f2937" strokeWidth="2" />
                            {/* Door */}
                            <rect x="8" y="15" width="4" height="5" fill="#1f2937" />
                          </>
                        ) : (
                          <>
                            {/* Roof */}
                            <path d="M2 12L12 4L22 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            {/* House body */}
                            <rect x="4" y="12" width="16" height="8" stroke="#6b7280" strokeWidth="2" strokeLinejoin="round" fill="none" />
                            {/* Chimney */}
                            <rect x="15" y="5" width="4" height="5" stroke="#6b7280" strokeWidth="2" fill="none" />
                            {/* Door */}
                            <rect x="8" y="15" width="4" height="5" stroke="#6b7280" strokeWidth="2" fill="none" />
                          </>
                        )}
                      </motion.svg>
                    </div>
                    <span className={`text-xs mt-0.5 relative z-10 ${isActive('/') ? 'font-medium text-neutral-700' : 'font-medium text-neutral-500'}`}>
                      Home
                    </span>
                  </Link>
                </motion.div>

                {/* Order Again */}
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="flex-1 h-full"
                >
                  <Link
                    to="/order-again"
                    className="flex flex-col items-center justify-center h-full relative"
                  >
                    <div className="flex flex-col items-center justify-center relative z-10">
                      <motion.svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        animate={isActive('/order-again') ? {
                          scale: [1, 1.1, 1],
                          y: [0, -2, 0]
                        } : {}}
                        transition={{
                          duration: 0.4,
                          ease: "easeInOut",
                          repeat: isActive('/order-again') ? Infinity : 0,
                          repeatDelay: 2
                        }}
                      >
                        {isActive('/order-again') ? (
                          <>
                            {/* Shopping bag body */}
                            <path d="M5 8V6C5 4.34315 6.34315 3 8 3H16C17.6569 3 19 4.34315 19 6V8H21C21.5523 8 22 8.44772 22 9V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V9C2 8.44772 2.44772 8 3 8H5Z" fill="#22c55e" stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" />
                            {/* Handles */}
                            <path d="M7 8V6C7 5.44772 7.44772 5 8 5H16C16.5523 5 17 5.44772 17 6V8" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" fill="none" />
                          </>
                        ) : (
                          <>
                            {/* Shopping bag body */}
                            <path d="M5 8V6C5 4.34315 6.34315 3 8 3H16C17.6569 3 19 4.34315 19 6V8H21C21.5523 8 22 8.44772 22 9V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V9C2 8.44772 2.44772 8 3 8H5Z" stroke="#6b7280" strokeWidth="2" strokeLinejoin="round" fill="none" />
                            {/* Handles */}
                            <path d="M7 8V6C7 5.44772 7.44772 5 8 5H16C16.5523 5 17 5.44772 17 6V8" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" fill="none" />
                          </>
                        )}
                        {/* Heart inside basket - grows when active, shrinks when inactive */}
                        <AnimatePresence>
                          {isActive('/order-again') && (
                            <motion.path
                              key="heart"
                              d="M12 17C11.5 16.5 8 13.5 8 11.5C8 10 9 9 10.5 9C11.2 9 11.8 9.3 12 9.7C12.2 9.3 12.8 9 13.5 9C15 9 16 10 16 11.5C16 13.5 12.5 16.5 12 17Z"
                              fill="#1f2937"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeOut" }}
                            />
                          )}
                        </AnimatePresence>
                      </motion.svg>
                    </div>
                    <span className={`text-[10px] mt-0.5 relative z-10 whitespace-nowrap ${isActive('/order-again') ? 'font-medium text-neutral-700' : 'font-medium text-neutral-500'}`}>
                      Order Again
                    </span>
                  </Link>
                </motion.div>

                {/* Brands */}
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="flex-1 h-full"
                >
                  <Link
                    to="/brands"
                    className="flex flex-col items-center justify-center h-full relative"
                  >
                    <div className="flex flex-col items-center justify-center relative z-10">
                      <motion.svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        animate={isActive('/brands') ? {
                          scale: [1, 1.1, 1],
                          rotate: [0, 5, -5, 0]
                        } : {}}
                        transition={{
                          duration: 0.4,
                          ease: "easeInOut",
                          repeat: isActive('/brands') ? Infinity : 0,
                          repeatDelay: 2
                        }}
                      >
                        {isActive('/brands') ? (
                          <>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#22c55e" stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M9 12l2 2 4-4" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </>
                        ) : (
                          <>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#6b7280" strokeWidth="2" strokeLinejoin="round" fill="none" />
                            <path d="M9 12l2 2 4-4" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </>
                        )}
                      </motion.svg>
                    </div>
                    <span className={`text-xs mt-0.5 relative z-10 ${isActive('/brands') ? 'font-medium text-neutral-700' : 'font-medium text-neutral-500'}`}>
                      Brand
                    </span>
                  </Link>
                </motion.div>



                {/* Video Finds */}
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="flex-1 h-full"
                >
                  <Link
                    to="/video-finds"
                    className="flex flex-col items-center justify-center h-full relative"
                  >
                    <div className="flex flex-col items-center justify-center relative z-10">
                      <motion.svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        animate={isActive('/video-finds') ? {
                          scale: [1, 1.1, 1]
                        } : {}}
                        transition={{
                          duration: 0.4,
                          ease: "easeInOut",
                          repeat: isActive('/video-finds') ? Infinity : 0,
                          repeatDelay: 2
                        }}
                      >
                         {isActive('/video-finds') ? (
                           <>
                             <rect x="2" y="4" width="20" height="16" rx="2" stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" fill="#22c55e" />
                             <path d="M10 9l5 3-5 3V9z" fill="#1f2937" stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" />
                           </>
                         ) : (
                           <>
                             <rect x="2" y="4" width="20" height="16" rx="2" stroke="#6b7280" strokeWidth="2" fill="none" />
                             <path d="M10 9l5 3-5 3V9z" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinejoin="round" />
                           </>
                         )}
                      </motion.svg>
                    </div>
                    <span className={`text-xs mt-0.5 relative z-10 ${isActive('/video-finds') ? 'font-medium text-neutral-700' : 'font-medium text-neutral-500'}`}>
                      Video Finds
                    </span>
                  </Link>
                </motion.div>

                {/* Categories */}
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="flex-1 h-full"
                >
                  <Link
                    to="/categories"
                    className="flex flex-col items-center justify-center h-full relative"
                  >
                    <div className="flex flex-col items-center justify-center relative z-10">
                      <motion.svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        animate={{
                          rotate: categoriesRotation
                        }}
                        transition={{
                          duration: 0.5,
                          ease: "easeInOut"
                        }}
                        style={{ transformOrigin: 'center' }}
                      >
                        {(isActive('/categories') || location.pathname.startsWith('/category/')) ? (
                          <>
                            {/* Top-left and bottom-right are black when active */}
                            <circle cx="7" cy="7" r="2.5" fill="#1f2937" stroke="#1f2937" strokeWidth="2" />
                            <circle cx="17" cy="7" r="2.5" fill="#22c55e" stroke="#1f2937" strokeWidth="2" />
                            <circle cx="7" cy="17" r="2.5" fill="#22c55e" stroke="#1f2937" strokeWidth="2" />
                            <circle cx="17" cy="17" r="2.5" fill="#1f2937" stroke="#1f2937" strokeWidth="2" />
                          </>
                        ) : (
                          <>
                            <circle cx="7" cy="7" r="2.5" stroke="#6b7280" strokeWidth="2" fill="none" />
                            <circle cx="17" cy="7" r="2.5" stroke="#6b7280" strokeWidth="2" fill="none" />
                            <circle cx="7" cy="17" r="2.5" stroke="#6b7280" strokeWidth="2" fill="none" />
                            <circle cx="17" cy="17" r="2.5" stroke="#6b7280" strokeWidth="2" fill="none" />
                          </>
                        )}
                      </motion.svg>
                    </div>
                    <span className={`text-xs mt-0.5 relative z-10 ${(isActive('/categories') || location.pathname.startsWith('/category/')) ? 'font-medium text-neutral-700' : 'font-medium text-neutral-500'}`}>
                      Categories
                    </span>
                  </Link>
                </motion.div>

                {/* Profile */}
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="flex-1 h-full"
                >
                  <Link
                    to="/account"
                    className="flex flex-col items-center justify-center h-full relative"
                  >
                    <div className="flex flex-col items-center justify-center relative z-10">
                      <motion.svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        animate={isActive('/account') ? {
                          scale: [1, 1.05, 1]
                        } : {}}
                        transition={{
                          duration: 0.5,
                          ease: "easeInOut",
                          repeat: isActive('/account') ? Infinity : 0,
                          repeatDelay: 1.5
                        }}
                      >
                        {isActive('/account') ? (
                          <>
                            {/* Profile head */}
                            <motion.circle
                              cx="12"
                              cy="8"
                              r="4"
                              fill="#22c55e"
                              stroke="#1f2937"
                              strokeWidth="2"
                              animate={{
                                scale: [1, 1.1, 1]
                              }}
                              transition={{
                                duration: 0.6,
                                ease: "easeInOut",
                                repeat: Infinity,
                                repeatDelay: 1.2
                              }}
                            />
                            {/* Profile body */}
                            <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" fill="#22c55e" />
                          </>
                        ) : (
                          <>
                            {/* Profile head */}
                            <circle cx="12" cy="8" r="4" stroke="#6b7280" strokeWidth="2" fill="none" />
                            {/* Profile body */}
                            <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" fill="none" />
                          </>
                        )}
                      </motion.svg>
                    </div>
                    <span className={`text-xs mt-0.5 relative z-10 ${isActive('/account') ? 'font-medium text-neutral-700' : 'font-medium text-neutral-500'}`}>
                      Profile
                    </span>
                  </Link>
                </motion.div>
              </div>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

