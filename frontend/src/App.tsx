import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy, startTransition } from "react";
import { CartProvider } from "./context/CartContext";
import { OrdersProvider } from "./context/OrdersContext";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LocationProvider } from "./context/LocationContext";
import { ToastProvider } from "./context/ToastContext";
import { ConfirmationProvider } from "./context/ConfirmationContext";

import { LoadingProvider } from "./context/LoadingContext";
import { AxiosLoadingInterceptor } from "./context/AxiosLoadingInterceptor";
import IconLoader from "./components/loaders/IconLoader";
import RouteLoaderTrigger from "./components/loaders/RouteLoaderTrigger";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import LoadingSpinner from "./components/LoadingSpinner";
import ErrorBoundary from "./components/ErrorBoundary";
import RouteTransition from "./components/RouteTransition";
import { useEffect } from "react";
import { requestNotificationPermission, onMessageListener } from "./services/pushNotificationService";
import { toast } from "react-hot-toast";

// Critical routes - load immediately (Home, Cart, Checkout)
import Home from "./modules/user/Home";
import Cart from "./modules/user/Cart";
import Checkout from "./modules/user/Checkout";
import CheckoutAddress from "./modules/user/CheckoutAddress";
import ProductDetail from "./modules/user/ProductDetail";

// Lazy load less critical routes for code splitting
const Search = lazy(() => import("./modules/user/Search"));
const Orders = lazy(() => import("./modules/user/Orders"));
const OrderDetail = lazy(() => import("./modules/user/OrderDetail"));
const OrderAgain = lazy(() => import("./modules/user/OrderAgain"));
const VideoFinds = lazy(() => import("./modules/user/VideoFinds"));
const Account = lazy(() => import("./modules/user/Account"));
const Categories = lazy(() => import("./modules/user/Categories"));
const Category = lazy(() => import("./modules/user/Category"));
const Invoice = lazy(() => import("./modules/user/Invoice"));
const Login = lazy(() => import("./modules/user/Login"));
const SignUp = lazy(() => import("./modules/user/SignUp"));
const AboutUs = lazy(() => import("./modules/user/AboutUs"));
const FAQ = lazy(() => import("./modules/user/FAQ"));
const Wishlist = lazy(() => import("./modules/user/Wishlist"));
const Addresses = lazy(() => import("./modules/user/Addresses"));
const AddressBook = lazy(() => import("./modules/user/AddressBook"));
const SpiritualStore = lazy(() => import("./modules/user/SpiritualStore"));
const PharmaStore = lazy(() => import("./modules/user/PharmaStore"));
const EGiftStore = lazy(() => import("./modules/user/EGiftStore"));
const PetStore = lazy(() => import("./modules/user/PetStore"));
const SportsStore = lazy(() => import("./modules/user/SportsStore"));
const FashionStore = lazy(() => import("./modules/user/FashionStore"));
const ToyStore = lazy(() => import("./modules/user/ToyStore"));
const HobbyStore = lazy(() => import("./modules/user/HobbyStore"));
const StorePage = lazy(() => import("./modules/user/StorePage"));
const Brands = lazy(() => import("./modules/user/Brands"));
const BrandProducts = lazy(() => import("./modules/user/BrandProducts"));
const FlashDealsPage = lazy(() => import("./modules/user/FlashDealsPage"));
const DealOfTheDayPage = lazy(() => import("./modules/user/DealOfTheDayPage"));
const FeaturedDealsPage = lazy(() => import("./modules/user/FeaturedDealsPage"));
const LowestPricesEverPage = lazy(() => import("./modules/user/LowestPricesEverPage"));
// Lazy load delivery routes
const DeliveryLayout = lazy(() => import("./modules/delivery/components/DeliveryLayout"));
const DeliveryDashboard = lazy(() => import("./modules/delivery/pages/DeliveryDashboard"));
const DeliveryOrders = lazy(() => import("./modules/delivery/pages/DeliveryOrders"));
const DeliveryOrderDetail = lazy(() => import("./modules/delivery/pages/DeliveryOrderDetail"));
const DeliveryNotifications = lazy(() => import("./modules/delivery/pages/DeliveryNotifications"));
const DeliveryMenu = lazy(() => import("./modules/delivery/pages/DeliveryMenu"));
const DeliveryPendingOrders = lazy(() => import("./modules/delivery/pages/DeliveryPendingOrders"));
const DeliveryAllOrders = lazy(() => import("./modules/delivery/pages/DeliveryAllOrders"));
const DeliveryReturnOrders = lazy(() => import("./modules/delivery/pages/DeliveryReturnOrders"));
const DeliveryProfile = lazy(() => import("./modules/delivery/pages/DeliveryProfile"));
const DeliveryEarnings = lazy(() => import("./modules/delivery/pages/DeliveryEarnings"));
const DeliverySettings = lazy(() => import("./modules/delivery/pages/DeliverySettings"));
const DeliveryHelp = lazy(() => import("./modules/delivery/pages/DeliveryHelp"));
const DeliveryAbout = lazy(() => import("./modules/delivery/pages/DeliveryAbout"));
const DeliverySellersInRange = lazy(() => import("./modules/delivery/pages/DeliverySellersInRange"));
const DeliveryLogin = lazy(() => import("./modules/delivery/pages/DeliveryLogin"));
const DeliverySignUp = lazy(() => import("./modules/delivery/pages/DeliverySignUp"));

// Lazy load seller routes
const SellerLayout = lazy(() => import("./modules/seller/components/SellerLayout"));
const SellerDashboard = lazy(() => import("./modules/seller/pages/SellerDashboard"));
const SellerOrders = lazy(() => import("./modules/seller/pages/SellerOrders"));
const SellerOrderDetail = lazy(() => import("./modules/seller/pages/SellerOrderDetail"));
const SellerCategory = lazy(() => import("./modules/seller/pages/SellerCategory"));
const SellerSubCategory = lazy(() => import("./modules/seller/pages/SellerSubCategory"));
const SellerAddProduct = lazy(() => import("./modules/seller/pages/SellerAddProduct"));
const SellerTaxes = lazy(() => import("./modules/seller/pages/SellerTaxes"));
const SellerProductList = lazy(() => import("./modules/seller/pages/SellerProductList"));
const SellerStockManagement = lazy(() => import("./modules/seller/pages/SellerStockManagement"));
const SellerWallet = lazy(() => import("./modules/seller/pages/SellerWallet"));
const SellerWalletTransactions = lazy(() => import("./modules/seller/pages/SellerWalletTransactions"));
const SellerWithdrawalRequests = lazy(() => import("./modules/seller/pages/SellerWithdrawalRequests"));
const SellerSalesReport = lazy(() => import("./modules/seller/pages/SellerSalesReport"));
const SellerReturnRequest = lazy(() => import("./modules/seller/pages/SellerReturnRequest"));
const SellerAccountSettings = lazy(() => import("./modules/seller/pages/SellerAccountSettings"));
const SellerLogin = lazy(() => import("./modules/seller/pages/SellerLogin"));
const SellerSignUp = lazy(() => import("./modules/seller/pages/SellerSignUp"));
const SellerBillSettings = lazy(() => import("./modules/seller/pages/SellerBillSettings"));
const SellerPOSOrders = lazy(() => import("./modules/seller/pages/SellerPOSOrders"));
const SellerPOSSuccess = lazy(() => import("./modules/seller/pages/SellerPOSSuccess"));
const SellerPOSCustomers = lazy(() => import("./modules/seller/pages/SellerPOSCustomers"));
const SellerPOSCustomerDetail = lazy(() => import("./modules/seller/pages/SellerPOSCustomerDetail"));
const SellerPOSCustomerOrders = lazy(() => import("./modules/seller/pages/SellerPOSCustomerOrders"));
const SellerPOSSuppliers = lazy(() => import("./modules/seller/pages/SellerPOSSuppliers"));
const SellerPOSSupplierDetail = lazy(() => import("./modules/seller/pages/SellerPOSSupplierDetail"));
const SellerPOSReport = lazy(() => import("./modules/seller/pages/SellerPOSReport"));
const SellerPurchaseReport = lazy(() => import("./modules/seller/pages/SellerPurchaseReport"));
const SellerPOSQuotations = lazy(() => import("./modules/seller/pages/SellerPOSQuotations"));
const SellerSalesSummary = lazy(() => import("./modules/seller/pages/SellerSalesSummary"));
const SellerAttributeSetup = lazy(() => import("./modules/seller/pages/SellerAttributeSetup"));
const SellerProductDisplaySettings = lazy(() => import("./modules/seller/pages/SellerProductDisplaySettings"));
const SellerBarcodeSettings = lazy(() => import("./modules/seller/pages/SellerBarcodeSettings"));
const SellerAllOrders = lazy(() => import("./modules/seller/pages/SellerAllOrders"));
const SellerPendingOrders = lazy(() => import("./modules/seller/pages/SellerPendingOrders"));
const SellerReceivedOrders = lazy(() => import("./modules/seller/pages/SellerReceivedOrders"));
const SellerProcessedOrders = lazy(() => import("./modules/seller/pages/SellerProcessedOrders"));
const SellerShippedOrders = lazy(() => import("./modules/seller/pages/SellerShippedOrders"));
const SellerOutForDeliveryOrders = lazy(() => import("./modules/seller/pages/SellerOutForDeliveryOrders"));
const SellerDeliveredOrders = lazy(() => import("./modules/seller/pages/SellerDeliveredOrders"));
const SellerCancelledOrders = lazy(() => import("./modules/seller/pages/SellerCancelledOrders"));
const SellerReturnRequests = lazy(() => import("./modules/seller/pages/SellerReturnRequests"));
const SellerReplaceRequests = lazy(() => import("./modules/seller/pages/SellerReplaceRequests"));
const SellerOnlineOrderReport = lazy(() => import("./modules/seller/pages/SellerOnlineOrderReport"));
const SellerInvoiceReport = lazy(() => import("./modules/seller/pages/SellerInvoiceReport"));
const SellerStockSummary = lazy(() => import("./modules/seller/pages/SellerStockSummary"));
const SellerStockBalanceSummary = lazy(() => import("./modules/seller/pages/SellerStockBalanceSummary"));
const SellerLowStockSummary = lazy(() => import("./modules/seller/pages/SellerLowStockSummary"));
const SellerOutOfStockSummary = lazy(() => import("./modules/seller/pages/SellerOutOfStockSummary"));
const SellerLossSummary = lazy(() => import("./modules/seller/pages/SellerLossSummary"));
const SellerGSTSalesReport = lazy(() => import("./modules/seller/pages/SellerGSTSalesReport"));
const SellerGSTReport = lazy(() => import("./modules/seller/pages/SellerGSTReport"));
const SellerPaymentReport = lazy(() => import("./modules/seller/pages/SellerPaymentReport"));
const SellerReportSalesSummary = lazy(() => import("./modules/seller/pages/SellerReportSalesSummary"));
const SellerReturnExchangeSummary = lazy(() => import("./modules/seller/pages/SellerReturnExchangeSummary"));
const SellerStockSalesSummary = lazy(() => import("./modules/seller/pages/SellerStockSalesSummary"));
const SellerDueSummary = lazy(() => import("./modules/seller/pages/SellerDueSummary"));
const SellerVariationTypeSetup = lazy(() => import("./modules/seller/pages/SellerVariationTypeSetup"));

// Lazy load admin routes
const AdminLayout = lazy(() => import("./modules/admin/components/AdminLayout"));
const AdminDashboard = lazy(() => import("./modules/admin/pages/AdminDashboard"));
const AdminLogin = lazy(() => import("./modules/admin/pages/AdminLogin"));
const AdminCategory = lazy(() => import("./modules/admin/pages/AdminCategory"));
const AdminHeaderCategory = lazy(() => import("./modules/admin/pages/AdminHeaderCategory"));
const AdminSubCategory = lazy(() => import("./modules/admin/pages/AdminSubCategory"));
const AdminBrand = lazy(() => import("./modules/admin/pages/AdminBrand"));
const AdminTaxes = lazy(() => import("./modules/admin/pages/AdminTaxes"));
const AdminSellerTransaction = lazy(() => import("./modules/admin/pages/AdminSellerTransaction"));
const AdminStockManagement = lazy(() => import("./modules/admin/pages/AdminStockManagement"));
const AdminAddProduct = lazy(() => import("./modules/admin/pages/AdminAddProduct"));
const AdminSubcategoryOrder = lazy(() => import("./modules/admin/pages/AdminSubcategoryOrder"));
const AdminManageSellerList = lazy(() => import("./modules/admin/pages/AdminManageSellerList"));
const AdminAddSeller = lazy(() => import("./modules/admin/pages/AdminAddSeller"));
const AdminSellerUserLimit = lazy(() => import("./modules/admin/pages/AdminSellerUserLimit"));
const AdminCoupon = lazy(() => import("./modules/admin/pages/AdminCoupon"));
const AdminNotification = lazy(() => import("./modules/admin/pages/AdminNotification"));
const AdminSellerLocation = lazy(() => import("./modules/admin/pages/AdminSellerLocation"));
const AdminWallet = lazy(() => import("./modules/admin/pages/AdminWallet"));
const AdminManageDeliveryBoy = lazy(() => import("./modules/admin/pages/AdminManageDeliveryBoy"));
const AdminAddDeliveryBoy = lazy(() => import("./modules/admin/pages/AdminAddDeliveryBoy"));
const AdminFundTransfer = lazy(() => import("./modules/admin/pages/AdminFundTransfer"));
const AdminCashCollection = lazy(() => import("./modules/admin/pages/AdminCashCollection"));
const AdminReturnRequest = lazy(() => import("./modules/admin/pages/AdminReturnRequest"));
const AdminPaymentList = lazy(() => import("./modules/admin/pages/AdminPaymentList"));
const AdminSmsGateway = lazy(() => import("./modules/admin/pages/AdminSmsGateway"));
const AdminSystemUser = lazy(() => import("./modules/admin/pages/AdminSystemUser"));
const AdminUsers = lazy(() => import("./modules/admin/pages/AdminUsers"));
const AdminFAQ = lazy(() => import("./modules/admin/pages/AdminFAQ"));
const AdminHomeSection = lazy(() => import("./modules/admin/pages/AdminHomeSection"));
const AdminBestsellerCards = lazy(() => import("./modules/admin/pages/AdminBestsellerCards"));
const AdminPromoStrip = lazy(() => import("./modules/admin/pages/AdminPromoStrip"));
const AdminLowestPrices = lazy(() => import("./modules/admin/pages/AdminLowestPrices"));
const AdminShopByStore = lazy(() => import("./modules/admin/pages/AdminShopByStore"));
const AdminAllOrders = lazy(() => import("./modules/admin/pages/AdminAllOrders"));
const AdminPendingOrders = lazy(() => import("./modules/admin/pages/AdminPendingOrders"));
const AdminReceivedOrders = lazy(() => import("./modules/admin/pages/AdminReceivedOrders"));
const AdminProcessedOrders = lazy(() => import("./modules/admin/pages/AdminProcessedOrders"));
const AdminShippedOrders = lazy(() => import("./modules/admin/pages/AdminShippedOrders"));
const AdminOutForDeliveryOrders = lazy(() => import("./modules/admin/pages/AdminOutForDeliveryOrders"));
const AdminDeliveredOrders = lazy(() => import("./modules/admin/pages/AdminDeliveredOrders"));
const AdminCancelledOrders = lazy(() => import("./modules/admin/pages/AdminCancelledOrders"));
const AdminCustomerAppPolicy = lazy(() => import("./modules/admin/pages/AdminCustomerAppPolicy"));
const AdminDeliveryAppPolicy = lazy(() => import("./modules/admin/pages/AdminDeliveryAppPolicy"));
const AdminOrders = lazy(() => import("./modules/admin/pages/AdminOrders"));
const AdminOrderDetail = lazy(() => import("./modules/admin/pages/AdminOrderDetail"));
const AdminManageCustomer = lazy(() => import("./modules/admin/pages/AdminManageCustomer"));
const AdminProfile = lazy(() => import("./modules/admin/pages/AdminProfile"));
const AdminPOSOrders = lazy(() => import("./modules/admin/pages/AdminPOSOrders"));
const AdminPOSSuccess = lazy(() => import("./modules/admin/pages/AdminPOSSuccess"));
const POSCreditVerify = lazy(() => import("./modules/shared/POSCreditVerify"));
const AdminPOSReport = lazy(() => import("./modules/admin/pages/AdminPOSReport"));
const AdminPurchaseReport = lazy(() => import("./modules/admin/pages/AdminPurchaseReport"));
const AdminPOSQuotations = lazy(() => import("./modules/admin/pages/AdminPOSQuotations"));
const AdminVideoManagement = lazy(() => import("./modules/admin/pages/AdminVideoManagement"));
const AdminProductDisplaySettings = lazy(() => import("./modules/admin/pages/AdminProductDisplaySettings"));
const AdminBarcodeSettings = lazy(() => import("./modules/admin/pages/AdminBarcodeSettings"));
const AdminDeliverySettings = lazy(() => import("./modules/admin/pages/AdminDeliverySettings"));
const AdminSalesSummary = lazy(() => import("./modules/admin/pages/AdminSalesSummary"));
const AdminPOSCustomers = lazy(() => import("./modules/admin/pages/AdminPOSCustomers"));
const AdminPOSCustomerDetail = lazy(() => import("./modules/admin/pages/AdminPOSCustomerDetail"));
const AdminPOSCustomerOrders = lazy(() => import("./modules/admin/pages/AdminPOSCustomerOrders"));
const AdminPOSSuppliers = lazy(() => import("./modules/admin/pages/AdminPOSSuppliers"));
const AdminPOSSupplierDetail = lazy(() => import("./modules/admin/pages/AdminPOSSupplierDetail"));
const AdminBannerSetup = lazy(() => import("./modules/admin/pages/AdminBannerSetup"));
const AdminFlashDeal = lazy(() => import("./modules/admin/pages/AdminFlashDeal"));
const AdminDealOfTheDay = lazy(() => import("./modules/admin/pages/AdminDealOfTheDay"));
const AdminFeaturedDeal = lazy(() => import("./modules/admin/pages/AdminFeaturedDeal"));
const AdminFirstOrderOffer = lazy(() => import("./modules/admin/pages/AdminFirstOrderOffer"));
const AdminFreeGiftRules = lazy(() => import("./modules/admin/pages/AdminFreeGiftRules"));
const AdminReturnRequests = lazy(() => import("./modules/admin/pages/AdminReturnRequests"));
const AdminReplaceRequests = lazy(() => import("./modules/admin/pages/AdminReplaceRequests"));
const AdminAttributeSetup = lazy(() => import("./modules/admin/pages/AdminAttributeSetup"));
const AdminVariationTypeSetup = lazy(() => import("./modules/admin/pages/AdminVariationTypeSetup"));
const AdminReportSalesSummary = lazy(() => import("./modules/admin/pages/AdminReportSalesSummary"));
const AdminReturnExchangeSummary = lazy(() => import("./modules/admin/pages/AdminReturnExchangeSummary"));
const AdminStockSalesSummary = lazy(() => import("./modules/admin/pages/AdminStockSalesSummary"));
const AdminDueSummary = lazy(() => import("./modules/admin/pages/AdminDueSummary"));
const AdminStockSummary = lazy(() => import("./modules/admin/pages/AdminStockSummary"));
const AdminStockBalanceSummary = lazy(() => import("./modules/admin/pages/AdminStockBalanceSummary"));
const AdminLowStockSummary = lazy(() => import("./modules/admin/pages/AdminLowStockSummary"));
const AdminOutOfStockSummary = lazy(() => import("./modules/admin/pages/AdminOutOfStockSummary"));
const AdminLossSummary = lazy(() => import("./modules/admin/pages/AdminLossSummary"));
const AdminGSTSalesReport = lazy(() => import("./modules/admin/pages/AdminGSTSalesReport"));
const AdminGSTReport = lazy(() => import("./modules/admin/pages/AdminGSTReport"));
const AdminPaymentReport = lazy(() => import("./modules/admin/pages/AdminPaymentReport"));
const AdminOnlineOrderReport = lazy(() => import("./modules/admin/pages/AdminOnlineOrderReport"));
const AdminPOSInvoiceReport = lazy(() => import("./modules/admin/pages/AdminPOSInvoiceReport"));
const AdminAbandonedCarts = lazy(() => import("./modules/admin/pages/AdminAbandonedCarts"));
const AdminPOSBillSettings = lazy(() => import("./modules/admin/pages/AdminPOSBillSettings"));
const AdminThemeSettings = lazy(() => import("./modules/admin/pages/AdminThemeSettings"));

import { useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import { AppProvider } from "./context/AppContext";
import { BrandingThemeProvider } from "./context/BrandingThemeContext";

const AdminManageStaff = lazy(() => import("./modules/admin/pages/AdminManageStaff"));
const AdminStoreSettings = lazy(() => import("./modules/admin/pages/AdminStoreSettings"));
const AdminAppSettings = lazy(() => import("./modules/admin/pages/AdminAppSettings"));
const StaffLogin = lazy(() => import("./modules/staff/pages/StaffLogin"));
const StaffBillReport = lazy(() => import("./modules/staff/pages/StaffBillReport"));

function NotificationHandler() {
  const { user, token: authToken } = useAuth();

  useEffect(() => {
    // Request/Refresh permission on app load if user is logged in
    const initNotifications = async () => {
       if (user && authToken) {
         // Map userType from AuthContext to expected type for fcm service
         const type = user.userType?.toLowerCase() as 'customer' | 'seller' | 'delivery' | 'admin';
         if (['customer', 'seller', 'delivery', 'admin'].includes(type)) {
           console.log(`[FCM-DEBUG] App load: Refreshing token for ${type}`);
           await requestNotificationPermission(type, authToken);
         }
       }
    };
    initNotifications();

    // Listen for foreground messages
    const unsubscribe = onMessageListener((payload: any) => {
      console.log('ðŸ”” [FCM-REALTIME] Foreground Notification:', {
        title: payload?.notification?.title,
        body: payload?.notification?.body,
        data: payload?.data
      });

      // 1. Show Toast for UI feedback
      toast.success((payload?.notification?.title || 'Notification') + ": " + (payload?.notification?.body || ''), {
        duration: 6000,
        position: 'top-right',
        icon: 'ðŸ””'
      });

      // 2. Show native browser notification as well for better visibility
      if (Notification.permission === 'granted') {
        try {
          new Notification(payload.notification.title, {
            body: payload.notification.body,
            icon: '/notification-icon.png',
            tag: 'geeta-notification' // Must match SW and Backend
          });
        } catch (err) {
          console.error('[FCM-DEBUG] Error showing native notification:', err);
        }
      }
    });

    return () => {
      // Cleanup if the onMessage returns an unsubscribe function (standard Firebase practice)
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user, authToken]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <LoadingProvider>
        <AxiosLoadingInterceptor>
          <AppProvider>
            <IconLoader />
            <AuthProvider>
            <NotificationHandler />
            <BrandingThemeProvider>
            <ThemeProvider>
              <LocationProvider>
                <ToastProvider>
                  <ConfirmationProvider>
                  <CartProvider>
                    <OrdersProvider>
                    <BrowserRouter
                      future={{
                        v7_startTransition: true,
                        v7_relativeSplatPath: true,
                      }}>
                      <Toaster />
                      <RouteLoaderTrigger />
                      <Routes>
                  {/* Public Routes */}
                  <Route
                    path="/login"
                    element={
                      <PublicRoute>
                        <Suspense fallback={<IconLoader forceShow />}>
                          <Login />
                        </Suspense>
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/signup"
                    element={
                      <PublicRoute>
                        <Suspense fallback={<IconLoader forceShow />}>
                          <SignUp />
                        </Suspense>
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/seller/login"
                    element={
                      <PublicRoute>
                        <Suspense fallback={<IconLoader forceShow />}>
                          <SellerLogin />
                        </Suspense>
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/seller/signup"
                    element={
                      <PublicRoute>
                        <Suspense fallback={<IconLoader forceShow />}>
                          <SellerSignUp />
                        </Suspense>
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/delivery/login"
                    element={
                      <PublicRoute>
                        <Suspense fallback={<IconLoader forceShow />}>
                          <DeliveryLogin />
                        </Suspense>
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/delivery/signup"
                    element={
                      <PublicRoute>
                        <Suspense fallback={<IconLoader forceShow />}>
                          <DeliverySignUp />
                        </Suspense>
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/admin/login"
                    element={
                      <PublicRoute>
                        <Suspense fallback={<IconLoader forceShow />}>
                          <AdminLogin />
                        </Suspense>
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/admin/staff-login"
                    element={
                      <Suspense fallback={<IconLoader forceShow />}>
                        <StaffLogin />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/seller/staff-login"
                    element={
                      <Suspense fallback={<IconLoader forceShow />}>
                        <StaffLogin />
                      </Suspense>
                    }
                  />

                  {/* Delivery App Routes */}
                  <Route
                    path="/delivery/*"
                    element={
                      <ProtectedRoute requiredUserType="Delivery" redirectTo="/delivery/login">
                        <Suspense fallback={<IconLoader forceShow />}>
                          <DeliveryLayout>
                            <Routes>
                              <Route path="" element={<DeliveryDashboard />} />
                              <Route path="orders" element={<DeliveryOrders />} />
                              <Route path="orders/:id" element={<DeliveryOrderDetail />} />
                              <Route path="orders/pending" element={<DeliveryPendingOrders />} />
                              <Route path="orders/all" element={<DeliveryAllOrders />} />
                              <Route path="orders/return" element={<DeliveryReturnOrders />} />
                              <Route path="notifications" element={<DeliveryNotifications />} />
                              <Route path="menu" element={<DeliveryMenu />} />
                              <Route path="profile" element={<DeliveryProfile />} />
                              <Route path="earnings" element={<DeliveryEarnings />} />
                              <Route path="settings" element={<DeliverySettings />} />
                              <Route path="help" element={<DeliveryHelp />} />
                              <Route path="about" element={<DeliveryAbout />} />
                              <Route path="sellers-in-range" element={<DeliverySellersInRange />} />
                            </Routes>
                          </DeliveryLayout>
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />

                  {/* Seller App Routes */}
                  <Route
                    path="/seller/*"
                    element={
                      <ProtectedRoute requiredUserType="Seller" redirectTo="/seller/login">
                        <Suspense fallback={<IconLoader forceShow />}>
                          <SellerLayout>
                            <Routes>
                              <Route path="" element={<SellerDashboard />} />
                               <Route path="orders" element={<SellerOrders />} />
                              <Route path="orders/all" element={<SellerAllOrders />} />
                              <Route path="orders/pending" element={<SellerPendingOrders />} />
                              <Route path="orders/received" element={<SellerReceivedOrders />} />
                              <Route path="orders/processed" element={<SellerProcessedOrders />} />
                              <Route path="orders/shipped" element={<SellerShippedOrders />} />
                              <Route path="orders/out-for-delivery" element={<SellerOutForDeliveryOrders />} />
                              <Route path="orders/delivered" element={<SellerDeliveredOrders />} />
                              <Route path="orders/cancelled" element={<SellerCancelledOrders />} />
                              <Route path="orders/:id" element={<SellerOrderDetail />} />
                              <Route path="return-requests" element={<SellerReturnRequests />} />
                              <Route path="replace-requests" element={<SellerReplaceRequests />} />
                              <Route path="manage-staff" element={<AdminManageStaff />} />
                              <Route path="staff-bill-report" element={<StaffBillReport />} />
                              <Route path="category" element={<SellerCategory />} />
                              <Route path="subcategory" element={<SellerSubCategory />} />
                              <Route path="product/add" element={<SellerAddProduct />} />
                              <Route path="product/edit/:id" element={<SellerAddProduct />} />
                              <Route path="product/taxes" element={<SellerTaxes />} />
                              <Route path="product/list" element={<SellerProductList />} />
                              <Route path="product/attribute-setup" element={<SellerAttributeSetup />} />
                              <Route path="product/variation-setup" element={<SellerVariationTypeSetup />} />
                              <Route path="product/stock" element={<SellerStockManagement />} />
                              <Route path="wallet" element={<SellerWallet />} />
                              <Route path="wallet/transactions" element={<SellerWalletTransactions />} />
                              <Route path="wallet/withdrawals" element={<SellerWithdrawalRequests />} />
                              <Route path="reports/sales" element={<SellerSalesReport />} />
                              <Route path="reports/order" element={<SellerOnlineOrderReport />} />
                              <Route path="reports/invoice" element={<SellerInvoiceReport />} />
                              <Route path="sales-summary" element={<SellerSalesSummary />} />
                              <Route path="account-settings" element={<SellerAccountSettings />} />
                              <Route path="pos/orders" element={<SellerPOSOrders />} />
                              <Route path="pos/success" element={<SellerPOSSuccess />} />
                              <Route path="pos/credit/verify" element={<POSCreditVerify portal="seller" />} />
                              <Route path="pos/customers" element={<SellerPOSCustomers />} />
                              <Route path="pos/customers/:id" element={<SellerPOSCustomerDetail />} />
                              <Route path="pos/customers/:id/orders" element={<SellerPOSCustomerOrders />} />
                               <Route path="pos/suppliers" element={<SellerPOSSuppliers />} />
                               <Route path="pos/suppliers/:id" element={<SellerPOSSupplierDetail />} />
                              <Route path="pos/report" element={<SellerPOSReport />} />
                              <Route path="purchase/report" element={<SellerPurchaseReport />} />
                              <Route path="pos/quotations" element={<SellerPOSQuotations />} />
                              <Route path="product-display-settings" element={<SellerProductDisplaySettings />} />
                              <Route path="bill-settings" element={<SellerBillSettings />} />
                              <Route path="barcode-settings" element={<SellerBarcodeSettings />} />
                              <Route path="inventory-reports/stock-summary" element={<SellerStockSummary />} />
                              <Route path="inventory-reports/stock-balance" element={<SellerStockBalanceSummary />} />
                              <Route path="inventory-reports/low-stock" element={<SellerLowStockSummary />} />
                              <Route path="inventory-reports/out-of-stock" element={<SellerOutOfStockSummary />} />
                              <Route path="inventory-reports/loss-summary" element={<SellerLossSummary />} />
                              <Route path="reports/gst-sales" element={<SellerGSTSalesReport />} />
                              <Route path="reports/gst-register" element={<SellerGSTReport />} />
                              <Route path="reports/payment" element={<SellerPaymentReport />} />
                              <Route path="reports/sales/summary" element={<SellerReportSalesSummary />} />
                              <Route path="reports/sales/return-exchange" element={<SellerReturnExchangeSummary />} />
                              <Route path="reports/sales/stock-sales" element={<SellerStockSalesSummary />} />
                              <Route path="reports/sales/due-summary" element={<SellerDueSummary />} />
                            </Routes>
                          </SellerLayout>
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin App Routes */}
                  <Route
                    path="/admin/*"
                    element={
                      <ProtectedRoute requiredUserType="Admin" redirectTo="/admin/login">
                        <Suspense fallback={<IconLoader forceShow />}>
                          <AdminLayout>
                            <Routes>
                             <Route path="pos/orders" element={<AdminPOSOrders />} />
                             <Route path="pos/success" element={<AdminPOSSuccess />} />
                             <Route path="pos/credit/verify" element={<POSCreditVerify portal="admin" />} />
                             <Route path="pos/customers" element={<AdminPOSCustomers />} />
                             <Route path="pos/customers/:id" element={<AdminPOSCustomerDetail />} />
                             <Route path="pos/customers/:id/orders" element={<AdminPOSCustomerOrders />} />
                             <Route path="pos/suppliers" element={<AdminPOSSuppliers />} />
                             <Route path="pos/suppliers/:id" element={<AdminPOSSupplierDetail />} />
                             <Route path="pos/report" element={<AdminPOSReport />} />
                             <Route path="purchase/report" element={<AdminPurchaseReport />} />
                             <Route path="pos/quotations" element={<AdminPOSQuotations />} />
                             <Route path="pos/bill-settings" element={<AdminPOSBillSettings />} />
                             <Route path="" element={<AdminDashboard />} />
                            <Route path="profile" element={<AdminProfile />} />
                            <Route path="category" element={<AdminCategory />} />
                            <Route path="category/header" element={<AdminHeaderCategory />} />
                            <Route path="subcategory" element={<AdminSubCategory />} />
                            <Route path="subcategory-order" element={<AdminSubcategoryOrder />} />
                            <Route path="brand" element={<AdminBrand />} />
                            <Route path="product/taxes" element={<AdminTaxes />} />
                            <Route path="product/attribute-setup" element={<AdminAttributeSetup />} />
                            <Route path="product/variation-setup" element={<AdminVariationTypeSetup />} />
                            <Route path="product/list" element={<AdminStockManagement />} />
                            <Route path="product/add" element={<AdminAddProduct />} />
                            <Route path="product/edit/:id" element={<AdminAddProduct />} />
                            <Route path="manage-seller/add" element={<AdminAddSeller />} />
                            <Route path="manage-seller/list" element={<AdminManageSellerList />} />
                            <Route path="manage-seller/transaction" element={<AdminSellerTransaction />} />
                            <Route path="manage-seller/user-limit" element={<AdminSellerUserLimit />} />
                            <Route path="delivery-boy/add" element={<AdminAddDeliveryBoy />} />
                            <Route path="delivery-boy/manage" element={<AdminManageDeliveryBoy />} />
                            <Route path="delivery-boy/fund-transfer" element={<AdminFundTransfer />} />
                            <Route path="delivery-boy/cash-collection" element={<AdminCashCollection />} />
                            <Route path="manage-location/seller-location" element={<AdminSellerLocation />} />
                            <Route path="wallet" element={<AdminWallet />} />
                            <Route path="coupon" element={<AdminCoupon />} />
                            <Route path="return" element={<AdminReturnRequest />} />
                            <Route path="notification" element={<AdminNotification />} />
                            <Route path="orders" element={<AdminOrders />} />
                            <Route path="customers" element={<AdminManageCustomer />} />
                             <Route path="customers/abandoned-carts" element={<AdminAbandonedCarts />} />
                            <Route path="collect-cash" element={<AdminCashCollection />} />
                            <Route path="payment-list" element={<AdminPaymentList />} />
                            <Route path="sms-gateway" element={<AdminSmsGateway />} />
                            <Route path="system-user" element={<AdminSystemUser />} />
                            <Route path="customer-app-policy" element={<AdminCustomerAppPolicy />} />
                            <Route path="delivery-app-policy" element={<AdminDeliveryAppPolicy />} />
                            <Route path="users" element={<AdminUsers />} />
                            <Route path="faq" element={<AdminFAQ />} />
                            <Route path="home-section" element={<AdminHomeSection />} />
                            <Route path="bestseller-cards" element={<AdminBestsellerCards />} />
                            <Route path="promo-strip" element={<AdminPromoStrip />} />
                            <Route path="lowest-prices" element={<AdminLowestPrices />} />
                            <Route path="shop-by-store" element={<AdminShopByStore />} />
                            <Route path="orders/all" element={<AdminAllOrders />} />
                            <Route path="orders/pending" element={<AdminPendingOrders />} />
                            <Route path="orders/received" element={<AdminReceivedOrders />} />
                            <Route path="orders/processed" element={<AdminProcessedOrders />} />
                            <Route path="orders/shipped" element={<AdminShippedOrders />} />
                            <Route path="orders/out-for-delivery" element={<AdminOutForDeliveryOrders />} />
                            <Route path="orders/delivered" element={<AdminDeliveredOrders />} />
                            <Route path="orders/cancelled" element={<AdminCancelledOrders />} />
                            <Route path="orders/cancelled" element={<AdminCancelledOrders />} />
                            <Route path="orders/:id" element={<AdminOrderDetail />} />
                            <Route path="video-finds" element={<AdminVideoManagement />} />
                            <Route path="product-display-settings" element={<AdminProductDisplaySettings />} />
                            <Route path="barcode-settings" element={<AdminBarcodeSettings />} />
                            <Route path="delivery-settings" element={<AdminDeliverySettings />} />
                            <Route path="sales-summary" element={<AdminSalesSummary />} />
                              <Route path="manage-staff" element={<AdminManageStaff />} />
                              <Route path="staff-bill-report" element={<StaffBillReport />} />
                            <Route path="settings/store" element={<AdminStoreSettings />} />
                            <Route path="app-settings" element={<AdminAppSettings />} />
                            <Route path="settings/theme" element={<AdminThemeSettings />} />

                            {/* Report Routes */}
                            <Route path="reports/sales/summary" element={<AdminReportSalesSummary />} />
                            <Route path="reports/sales/return-exchange" element={<AdminReturnExchangeSummary />} />
                            <Route path="reports/sales/stock-sales" element={<AdminStockSalesSummary />} />
                            <Route path="reports/sales/due-summary" element={<AdminDueSummary />} />
                            <Route path="reports/inventory/stock-summary" element={<AdminStockSummary />} />
                            <Route path="reports/inventory/stock-balance" element={<AdminStockBalanceSummary />} />
                            <Route path="reports/inventory/low-stock" element={<AdminLowStockSummary />} />
                            <Route path="reports/inventory/out-of-stock" element={<AdminOutOfStockSummary />} />
                            <Route path="reports/inventory/loss-summary" element={<AdminLossSummary />} />
                            <Route path="reports/gst-sales" element={<AdminGSTSalesReport />} />
                            <Route path="reports/gst-register" element={<AdminGSTReport />} />
                            <Route path="reports/payment" element={<AdminPaymentReport />} />
                            <Route path="reports/order" element={<AdminOnlineOrderReport />} />
                            <Route path="reports/invoice" element={<AdminPOSInvoiceReport />} />

                            {/* Promotion Routes */}
                            <Route path="promotion/banner-setup" element={<AdminBannerSetup />} />
                            <Route path="promotion/flash-deals" element={<AdminFlashDeal />} />
                            <Route path="promotion/deal-of-the-day" element={<AdminDealOfTheDay />} />
                            <Route path="promotion/featured-deal" element={<AdminFeaturedDeal />} />
                            <Route path="promotion/first-order-offer" element={<AdminFirstOrderOffer />} />
                            <Route path="promotion/free-gift-rules" element={<AdminFreeGiftRules />} />

                            <Route path="return-requests" element={<AdminReturnRequests />} />
                            <Route path="replace-requests" element={<AdminReplaceRequests />} />

                            <Route path="banner-management" element={<AdminBannerSetup />} />
                          </Routes>
                        </AdminLayout>
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />

                  {/* Main App Routes */}
                  <Route
                    path="/*"
                    element={
                      <AppLayout>
                        <Suspense fallback={<IconLoader forceShow />}>
                          <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/user/home" element={<Home />} />
                            <Route path="/search" element={<Search />} />
                            <Route path="/orders" element={<Orders />} />
                            <Route path="/orders/:id" element={<OrderDetail />} />
                            <Route path="/order-again" element={<OrderAgain />} />
                            <Route path="/video-finds" element={<VideoFinds />} />
                            <Route path="/account" element={<Account />} />
                            <Route path="/about-us" element={<AboutUs />} />
                            <Route path="/faq" element={<FAQ />} />
                            <Route path="/wishlist" element={<Wishlist />} />
                            <Route path="/categories" element={<Categories />} />
                            <Route path="/category/:id" element={<Category />} />
                            <Route path="/address-book" element={<AddressBook />} />
                            <Route path="/checkout" element={<Checkout />} />
                            <Route path="/checkout/address" element={<CheckoutAddress />} />
                            <Route path="/product/:id" element={<ProductDetail />} />
                            <Route path="/invoice/:id" element={<Invoice />} />
                            <Route path="/cart" element={<Cart />} />
                            <Route path="/addresses" element={<Addresses />} />
                            <Route path="/store/:slug" element={<StorePage />} />
                            <Route path="/store/spiritual" element={<SpiritualStore />} />
                            <Route path="/store/pharma" element={<PharmaStore />} />
                            <Route path="/store/e-gifts" element={<EGiftStore />} />
                            <Route path="/store/pet" element={<PetStore />} />
                            <Route path="/store/sports" element={<SportsStore />} />
                            <Route path="/store/fashion-basics" element={<FashionStore />} />
                            <Route path="/store/toy" element={<ToyStore />} />
                            <Route path="/store/hobby" element={<HobbyStore />} />
                            <Route path="/brands" element={<Brands />} />
                            <Route path="/brand/:id" element={<BrandProducts />} />
                            <Route path="/flash-deals" element={<FlashDealsPage />} />
                            <Route path="/featured-deals" element={<FeaturedDealsPage />} />
                            <Route path="/deal-of-the-day" element={<DealOfTheDayPage />} />
                            <Route path="/lowest-prices-ever" element={<LowestPricesEverPage />} />
                          </Routes>
                        </Suspense>
                      </AppLayout>
                    }
                  />
                  </Routes>
                </BrowserRouter>
                  </OrdersProvider>
                </CartProvider>
                  </ConfirmationProvider>
                </ToastProvider>
              </LocationProvider>

            </ThemeProvider>
            </BrandingThemeProvider>
          </AuthProvider>
          </AppProvider>
        </AxiosLoadingInterceptor>
      </LoadingProvider>
    </ErrorBoundary>
  );
}

export default App;
