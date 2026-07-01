import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import FloatingCartPill from './FloatingCartPill';
import { useLocation as useLocationContext } from '../hooks/useLocation';
import LocationPermissionRequest from './LocationPermissionRequest';
import { useThemeContext } from '../context/ThemeContext';
import QRScannerModal from './QRScannerModal';
import { openBarcodeScanner } from '../utils/scannerPlatform';
import { useAppContext } from '../context/AppContext';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);
  const restoreAttemptsRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [categoriesRotation, setCategoriesRotation] = useState(0);
  const [prevCategoriesActive, setPrevCategoriesActive] = useState(false);
  const { isLocationEnabled, isLocationLoading, location: userLocation } = useLocationContext();
  const [showLocationRequest, setShowLocationRequest] = useState(false);
  const [showLocationChangeModal, setShowLocationChangeModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const { currentTheme } = useThemeContext();
  const { config } = useAppContext();

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

    // Only update URL params if we are ALREADY on the search page
    // If not, we just show suggestions and wait for an explicit action (click or Enter)
    if (location.pathname === '/search') {
      if (value.trim()) {
        setSearchParams({ q: value });
      } else {
        setSearchParams({});
      }
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };




  // Preserve scroll position on back/forward while keeping fresh navigations at the top.
  useEffect(() => {
    return () => {
      if (restoreAttemptsRef.current !== null) {
        window.clearTimeout(restoreAttemptsRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const scrollContainer = mainRef.current;
    if (!scrollContainer) {
      return;
    }

    const pageKey = `${location.pathname}${location.search}`;
    const storageKey = `app-layout-scroll:${pageKey}`;

    const getScrollSnapshot = () => {
      const mainTop = scrollContainer.scrollTop;
      const windowTop = window.scrollY || window.pageYOffset || 0;

      return {
        mainTop,
        windowTop,
        preferredTarget: windowTop > mainTop ? 'window' : 'main',
      };
    };

    const saveScrollPosition = () => {
      sessionStorage.setItem(storageKey, JSON.stringify(getScrollSnapshot()));
    };

    const resetToTop = () => {
      scrollContainer.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };

    const historyRestore = (location.state as any)?.scrollRestore;

    const restoreScrollPosition = () => {
      const savedValue =
        historyRestore?.pageKey === pageKey
          ? JSON.stringify(historyRestore)
          : null;

      if (savedValue === null) {
        resetToTop();
        return;
      }

      let attempts = 0;
      let parsedSnapshot: { mainTop?: number; windowTop?: number; preferredTarget?: 'main' | 'window' } | null = null;

      try {
        parsedSnapshot = JSON.parse(savedValue);
      } catch {
        parsedSnapshot = { mainTop: Number(savedValue), windowTop: 0, preferredTarget: 'main' };
      }

      const targetMainTop = Number(parsedSnapshot?.mainTop || 0);
      const targetWindowTop = Number(parsedSnapshot?.windowTop || 0);
      const preferredTarget = parsedSnapshot?.preferredTarget || 'main';

      const applyRestore = () => {
        const maxMainTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
        const nextMainTop = Math.min(targetMainTop, maxMainTop);

        scrollContainer.scrollTop = nextMainTop;
        window.scrollTo({
          top: targetWindowTop,
          left: 0,
          behavior: 'instant',
        });

        const mainSettled = nextMainTop === targetMainTop || targetMainTop === 0;
        const windowSettled = Math.abs(window.scrollY - targetWindowTop) < 2 || targetWindowTop === 0;
        const canStop =
          attempts >= 12 ||
          (preferredTarget === 'window' ? windowSettled : mainSettled);

        if (canStop) {
          restoreAttemptsRef.current = null;
          return;
        }

        attempts += 1;
        restoreAttemptsRef.current = window.setTimeout(applyRestore, 80);
      };

      requestAnimationFrame(applyRestore);
    };

    if (restoreAttemptsRef.current !== null) {
      window.clearTimeout(restoreAttemptsRef.current);
      restoreAttemptsRef.current = null;
    }

    if (navigationType === 'POP' && historyRestore?.pageKey === pageKey) {
      restoreScrollPosition();
    } else {
      resetToTop();
    }

    scrollContainer.addEventListener('scroll', saveScrollPosition, { passive: true });
    window.addEventListener('pagehide', saveScrollPosition);

    return () => {
      saveScrollPosition();
      scrollContainer.removeEventListener('scroll', saveScrollPosition);
      window.removeEventListener('pagehide', saveScrollPosition);
    };
  }, [location.key, location.pathname, location.search, navigationType]);

  // Focus-on-back from the "View Similar Products" button on ProductDetail.
  // The button stashes the productId in sessionStorage before calling
  // navigate(-1); on the landing route we wait for the listing to mount, then
  // scroll the matching ProductCard (`#product-<id>`) into view and pulse a
  // brand-colored outline so the customer instantly sees where they came from.
  useEffect(() => {
    let focusProductId: string | null = null;
    try {
      focusProductId = sessionStorage.getItem('viewSimilarProducts.focusProductId');
    } catch {
      focusProductId = null;
    }
    if (!focusProductId) return;

    // Don't try to focus on the product page itself — only on listings.
    if (location.pathname.startsWith('/product/')) return;

    let attempts = 0;
    let timeoutId: number | null = null;
    let cleanupTimeoutId: number | null = null;

    const tryFocus = () => {
      const target = document.getElementById(`product-${focusProductId}`);
      if (!target) {
        attempts += 1;
        if (attempts > 30) {
          // Give up after ~3s — the listing either doesn't include this product
          // (e.g. user came from a different category) or it's lazy-loaded
          // beyond what we render. Clear the marker either way so we don't
          // keep hunting on subsequent navigations.
          try { sessionStorage.removeItem('viewSimilarProducts.focusProductId'); } catch {}
          return;
        }
        timeoutId = window.setTimeout(tryFocus, 100);
        return;
      }

      try { sessionStorage.removeItem('viewSimilarProducts.focusProductId'); } catch {}

      target.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Brief highlight pulse — uses inline style so it doesn't depend on any
      // Tailwind class being statically extracted.
      const previousBoxShadow = target.style.boxShadow;
      const previousTransition = target.style.transition;
      target.style.transition = 'box-shadow 0.4s ease-out';
      target.style.boxShadow = '0 0 0 3px var(--customer-primary), 0 0 18px 4px var(--customer-primary-alpha-30)';
      cleanupTimeoutId = window.setTimeout(() => {
        if (!target) return;
        target.style.boxShadow = previousBoxShadow;
        target.style.transition = previousTransition;
      }, 1800);
    };

    // Wait one frame for the route's content to mount before the first lookup.
    const rafId = requestAnimationFrame(() => {
      timeoutId = window.setTimeout(tryFocus, 80);
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (cleanupTimeoutId !== null) window.clearTimeout(cleanupTimeoutId);
    };
  }, [location.key, location.pathname, location.search]);

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
  const showHeader = false;
  const showSearchBar = false;
  const showFooter = !isCheckoutPage && !isProductDetailPage;

  // Search Suggestions State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!showSearchBar || !searchQuery.trim() || searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsSearchingSuggestions(true);
      try {
        const { getSearchSuggestions } = await import('../services/api/customerProductService');
        console.log(`🔍 Suggestion fetching for: "${searchQuery}"`);
        const response = await getSearchSuggestions(
          searchQuery,
          userLocation?.latitude,
          userLocation?.longitude
        );
        console.log(`✅ Suggestions response:`, response);
        if (response.success) {
          setSuggestions(response.data);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error("❌ Error fetching suggestions:", error);
      } finally {
        setIsSearchingSuggestions(false);
      }
    };

    const timeout = setTimeout(fetchSuggestions, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery, userLocation, showSearchBar]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSuggestionClick = (item: any) => {
    setShowSuggestions(false);
    setSearchQuery(item.name);

    if (item.type === 'product') {
      navigate(`/product/${item.id}`);
    } else if (item.type === 'category') {
      navigate(`/category/${item.id}`);
    } else {
      // General search
      navigate(`/search?q=${encodeURIComponent(item.name)}`);
    }
  };

  // Sync searchQuery with URL params for browser back/forward and initial load
  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== searchQuery) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden">
      {/* Desktop Container Wrapper */}
      <div className="md:w-full md:bg-white md:min-h-screen overflow-x-hidden">
        <div className="md:w-full md:min-h-screen md:flex md:flex-col overflow-x-hidden">
          {/* Top Navigation Bar - Desktop Only */}
          {showFooter && (
            <nav
              className="hidden md:flex items-center px-6 lg:px-8 py-3 shadow-sm transition-colors duration-300"
              style={{
                background: `linear-gradient(to right, ${currentTheme.primary[0]}, ${currentTheme.primary[1]})`,
                borderBottom: `1px solid ${currentTheme.primary[0]}`
              }}
            >
              {/* Logo - Desktop Only */}
              <Link to="/" className="flex items-center flex-shrink-0">
                <img
                  src={config?.appLogo || "/assets/geetastoreslogo.png"}
                  alt={config?.appName || "Geeta Stores"}
                  className="h-12 w-auto object-contain"
                />
              </Link>

              <div className="flex items-center justify-center gap-8 flex-1">
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
              </div>
            </nav>
          )}

          {/* Sticky Header - Show on search page and other non-home pages, excluding account page */}
          {showHeader && (
            <header className="sticky top-0 z-50 bg-white shadow-sm md:shadow-md md:top-[60px]">
              {/* Delivery info line */}
              <div className="px-4 md:px-6 lg:px-8 py-1.5 bg-[var(--customer-primary-alpha-10)] text-[var(--customer-primary-dark)] text-center">
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
                  className="text-[var(--customer-primary-dark)] font-medium hover:text-blue-700 transition-colors flex-shrink-0 ml-2"
                >
                  Change
                </button>
              </div>
              )}

              {/* Search bar - Hidden on Order Again page */}
              {showSearchBar && (
                <div className="px-4 md:px-6 lg:px-8 pb-3">
                  <div className="relative max-w-2xl md:mx-auto flex gap-2" ref={suggestionRef}>
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                        placeholder="Search for products..."
                        className="w-full px-4 py-2.5 pl-10 bg-neutral-50 border border-neutral-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[var(--customer-primary)] focus:border-transparent md:py-3"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">🔍</span>

                      {/* Suggestions Dropdown */}
                      <AnimatePresence>
                        {showSuggestions && suggestions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-neutral-100 overflow-hidden z-[100] max-h-[70vh] overflow-y-auto ring-1 ring-black/5"
                          >
                            <div className="py-1">
                              {suggestions.map((item, index) => (
                                <button
                                  key={`${item.type}-${item.id}-${index}`}
                                  onClick={() => handleSuggestionClick(item)}
                                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left group border-b border-neutral-50 last:border-0"
                                >
                                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-neutral-50 group-hover:bg-white transition-colors overflow-hidden">
                                    {item.type === 'search' ? (
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-neutral-400">
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.35-4.35" />
                                      </svg>
                                    ) : item.image ? (
                                      <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                                    ) : (
                                      <span className="text-xl">
                                        {item.type === 'category' ? '📁' : '📦'}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-neutral-900 group-hover:text-[var(--customer-primary-dark)] transition-colors truncate">
                                        {item.name}
                                      </span>
                                      {item.type === 'category' ? (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 uppercase tracking-tight">
                                          Category
                                        </span>
                                      ) : item.categoryName && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-50 text-neutral-500 uppercase tracking-tight">
                                          {item.categoryName}
                                        </span>
                                      )}
                                    </div>
                                    {item.type === 'product' && item.price !== undefined && (
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs font-bold text-[var(--customer-primary-dark)]">₹{item.price}</span>
                                        {item.mrp > item.price && (
                                          <span className="text-[10px] text-neutral-400 line-through">₹{item.mrp}</span>
                                        )}
                                        {item.discount > 0 && (
                                          <span className="text-[10px] text-[var(--customer-primary)] font-medium">({item.discount}% OFF)</span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-300 group-hover:text-[var(--customer-primary)]">
                                      <path d="M7 17l9.2-9.2M17 17V7H7" />
                                    </svg>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {isSearchingSuggestions && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--customer-primary)] border-t-transparent"></div>
                        </div>
                      )}
                    </div>

                    {/* Scanner Button */}
                    <button
                        onClick={() => openBarcodeScanner(() => setShowScanner(true))}
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
          <main
            ref={mainRef}
            className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide pb-24 md:pb-8"
            style={{ overflowAnchor: 'none' }}
          >
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
                            <path d="M2 12L12 4L22 12" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={currentTheme.primary[0]} />
                            {/* House body */}
                            <rect x="4" y="12" width="16" height="8" fill={currentTheme.primary[0]} stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" />
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
                            <path d="M5 8V6C5 4.34315 6.34315 3 8 3H16C17.6569 3 19 4.34315 19 6V8H21C21.5523 8 22 8.44772 22 9V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V9C2 8.44772 2.44772 8 3 8H5Z" fill={currentTheme.primary[0]} stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" />
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
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={currentTheme.primary[0]} stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" />
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
                             <rect x="2" y="4" width="20" height="16" rx="2" stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" fill={currentTheme.primary[0]} />
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
                            <circle cx="17" cy="7" r="2.5" fill={currentTheme.primary[0]} stroke="#1f2937" strokeWidth="2" />
                            <circle cx="7" cy="17" r="2.5" fill={currentTheme.primary[0]} stroke="#1f2937" strokeWidth="2" />
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
                              fill={currentTheme.primary[0]}
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
                            <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" fill={currentTheme.primary[0]} />
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
