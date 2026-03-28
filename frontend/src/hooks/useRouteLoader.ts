import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoading } from '../context/LoadingContext';

const useRouteLoader = () => {
  const location = useLocation();
  const { startRouteLoading, stopRouteLoading } = useLoading();
  const isInitialMount = useRef(true);

  useEffect(() => {
    const path = location.pathname;
    const isBackofficeRoute = path.startsWith('/admin') || path.startsWith('/seller');
    const isUserAppRoute = !path.startsWith('/admin') && !path.startsWith('/seller') && !path.startsWith('/delivery');
    const isDeliveryAuthRoute = path === '/delivery/login' || path === '/delivery/signup';
    const isDeliveryTabRoute =
      path === '/delivery' ||
      path === '/delivery/orders' ||
      path === '/delivery/notifications' ||
      path === '/delivery/menu';

    // On initial mount, the LoadingProvider started route loading (count=1).
    // We must always stop it once after first paint, otherwise the app can remain in a "loading" state.
    if (isInitialMount.current) {
      const timer = setTimeout(() => {
        stopRouteLoading();
        isInitialMount.current = false;
      }, 100);

      return () => clearTimeout(timer);
    }

    // Admin/Seller: don't show full-screen route loader on sidebar navigation
    // (it makes SPA navigation look like full reload).
    if (isBackofficeRoute) {
      return;
    }

    // Delivery auth: avoid full-screen loader when switching between login/signup
    // (it makes the page look like a full refresh).
    if (isDeliveryAuthRoute) {
      return;
    }

    // Delivery bottom nav: avoid full-screen loader when switching tabs
    // (it makes SPA navigation look like full reload).
    if (isDeliveryTabRoute) {
      return;
    }

    // User app: avoid full-screen loader on bottom nav navigation
    if (isUserAppRoute) {
      return;
    }

    startRouteLoading();
    const timer = setTimeout(() => {
      stopRouteLoading();
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname, startRouteLoading, stopRouteLoading]);
};

export default useRouteLoader;
