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
const SellerSalesReport = lazy(() => import("./modules/seller/pages/SellerSalesReport"));
const SellerReturnRequest = lazy(() => import("./modules/seller/pages/SellerReturnRequest"));
const SellerAccountSettings = lazy(() => import("./modules/seller/pages/SellerAccountSettings"));
const SellerLogin = lazy(() => import("./modules/seller/pages/SellerLogin"));
const SellerSignUp = lazy(() => import("./modules/seller/pages/SellerSignUp"));

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
const AdminCoupon = lazy(() => import("./modules/admin/pages/AdminCoupon"));
const AdminNotification = lazy(() => import("./modules/admin/pages/AdminNotification"));
const AdminSellerLocation = lazy(() => import("./modules/admin/pages/AdminSellerLocation"));
const AdminWallet = lazy(() => import("./modules/admin/pages/AdminWallet"));
const AdminManageDeliveryBoy = lazy(() => import("./modules/admin/pages/AdminManageDeliveryBoy"));
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
const AdminPOSReport = lazy(() => import("./modules/admin/pages/AdminPOSReport"));
const AdminVideoManagement = lazy(() => import("./modules/admin/pages/AdminVideoManagement"));
const AdminProductDisplaySettings = lazy(() => import("./modules/admin/pages/AdminProductDisplaySettings"));
const AdminBarcodeSettings = lazy(() => import("./modules/admin/pages/AdminBarcodeSettings"));
const AdminDeliverySettings = lazy(() => import("./modules/admin/pages/AdminDeliverySettings"));
const AdminSalesSummary = lazy(() => import("./modules/admin/pages/AdminSalesSummary"));
const AdminPOSCustomers = lazy(() => import("./modules/admin/pages/AdminPOSCustomers"));
const AdminPOSCustomerDetail = lazy(() => import("./modules/admin/pages/AdminPOSCustomerDetail"));
const AdminBannerSetup = lazy(() => import("./modules/admin/pages/AdminBannerSetup"));
const AdminFlashDeal = lazy(() => import("./modules/admin/pages/AdminFlashDeal"));
const AdminDealOfTheDay = lazy(() => import("./modules/admin/pages/AdminDealOfTheDay"));
const AdminFeaturedDeal = lazy(() => import("./modules/admin/pages/AdminFeaturedDeal"));
const AdminFreeGiftRules = lazy(() => import("./modules/admin/pages/AdminFreeGiftRules"));
const AdminReturnRequests = lazy(() => import("./modules/admin/pages/AdminReturnRequests"));
const AdminReplaceRequests = lazy(() => import("./modules/admin/pages/AdminReplaceRequests"));
const AdminAttributeSetup = lazy(() => import("./modules/admin/pages/AdminAttributeSetup"));
import { useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

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
      console.log('🔔 [FCM-REALTIME] Foreground Notification:', {
        title: payload?.notification?.title,
        body: payload?.notification?.body,
        data: payload?.data
      });

      // 1. Show Toast for UI feedback
      toast.success((payload?.notification?.title || 'Notification') + ": " + (payload?.notification?.body || ''), {
        duration: 6000,
        position: 'top-right',
        icon: '🔔'
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
          <IconLoader />
          <AuthProvider>
            <NotificationHandler />
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
                              <Route path="orders/:id" element={<SellerOrderDetail />} />
                              <Route path="category" element={<SellerCategory />} />
                              <Route path="subcategory" element={<SellerSubCategory />} />
                              <Route path="product/add" element={<SellerAddProduct />} />
                              <Route path="product/edit/:id" element={<SellerAddProduct />} />
                              <Route path="product/taxes" element={<SellerTaxes />} />
                              <Route path="product/list" element={<SellerProductList />} />
                              <Route path="product/stock" element={<SellerStockManagement />} />
                              {/* <Route path="return" element={<SellerReturnRequest />} />
                              <Route path="return-order" element={<SellerReturnRequest />} /> */}
                              {/* <Route path="wallet" element={<SellerWallet />} /> */}
                              <Route path="reports/sales" element={<SellerSalesReport />} />
                              <Route path="account-settings" element={<SellerAccountSettings />} />
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
                             <Route path="pos/customers" element={<AdminPOSCustomers />} />
                             <Route path="pos/customers/:id" element={<AdminPOSCustomerDetail />} />
                             <Route path="pos/report" element={<AdminPOSReport />} />
                             <Route path="" element={<AdminDashboard />} />
                            <Route path="profile" element={<AdminProfile />} />
                            <Route path="category" element={<AdminCategory />} />
                            <Route path="category/header" element={<AdminHeaderCategory />} />
                            <Route path="subcategory" element={<AdminSubCategory />} />
                            <Route path="subcategory-order" element={<AdminSubcategoryOrder />} />
                            <Route path="brand" element={<AdminBrand />} />
                            <Route path="product/taxes" element={<AdminTaxes />} />
                            <Route path="product/attribute-setup" element={<AdminAttributeSetup />} />
                            <Route path="product/list" element={<AdminStockManagement />} />
                            <Route path="product/add" element={<AdminAddProduct />} />
                            <Route path="product/edit/:id" element={<AdminAddProduct />} />
                            <Route path="manage-seller/list" element={<AdminManageSellerList />} />
                            <Route path="manage-seller/transaction" element={<AdminSellerTransaction />} />
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

                            {/* Promotion Routes */}
                            <Route path="promotion/banner-setup" element={<AdminBannerSetup />} />
                            <Route path="promotion/flash-deals" element={<AdminFlashDeal />} />
                            <Route path="promotion/deal-of-the-day" element={<AdminDealOfTheDay />} />
                            <Route path="promotion/featured-deal" element={<AdminFeaturedDeal />} />
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
                            <Route path="/deal-of-the-day" element={<DealOfTheDayPage />} />
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
          </AuthProvider>
        </AxiosLoadingInterceptor>
      </LoadingProvider>
    </ErrorBoundary>
  );
}

export default App;
