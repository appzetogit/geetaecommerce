import { Router } from "express";
import adminAuthRoutes from "./adminAuthRoutes";
import sellerAuthRoutes from "./sellerAuthRoutes";
import dashboardRoutes from "./dashboardRoutes";
import customerAuthRoutes from "./customerAuthRoutes";
import deliveryRoutes from "./deliveryRoutes";
import deliveryAuthRoutes from "./deliveryAuthRoutes";
import fcmRoutes from "../modules/notification/routes/fcmRoutes";

// ... (other imports)
import { authenticate, requireUserType } from "../middleware/auth";
import customerRoutes from "./customerRoutes";
import sellerRoutes from "./sellerRoutes";
import uploadRoutes from "./uploadRoutes";
import productRoutes from "./productRoutes";
import headerCategoryRoutes from "./headerCategoryRoutes";
import categoryRoutes from "./categoryRoutes";
import orderRoutes from "./orderRoutes";
import returnRoutes from "./returnRoutes";
import reportRoutes from "./reportRoutes";
import walletRoutes from "./walletRoutes";
import taxRoutes from "./taxRoutes";
import customerProductRoutes from "./customerProductRoutes";
import customerCategoryRoutes from "./customerCategoryRoutes";
import customerCouponRoutes from "./customerCouponRoutes";
import customerAddressRoutes from "./customerAddressRoutes";
import customerHomeRoutes from "./customerHomeRoutes";
import customerCartRoutes from "./customerCartRoutes";
import wishlistRoutes from "./wishlistRoutes";
import productReviewRoutes from "./productReviewRoutes";
import bannerRoutes from "./bannerRoutes";
import flashDealRoutes from "./flashDealRoutes";
import adminRoutes from "./adminRoutes";
import customerTrackingRoutes from "../modules/customer/routes/trackingRoutes";
import deliveryTrackingRoutes from "../modules/delivery/routes/trackingRoutes";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  updateOrderNotes,
  initiateOnlineOrder,
  verifyOnlinePayment,
  requestReturnOrReplace
} from "../modules/customer/controllers/customerOrderController";

const router = Router();

// Health check route
router.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
router.use("/auth/admin", adminAuthRoutes);
router.use("/auth/seller", sellerAuthRoutes);
router.use("/auth/customer", customerAuthRoutes);
router.use("/auth/delivery", deliveryAuthRoutes);

// Delivery routes (protected)
router.use(
  "/delivery",
  authenticate,
  requireUserType("Delivery"),
  deliveryRoutes
);
router.use(
  "/delivery",
  authenticate,
  requireUserType("Delivery"),
  deliveryTrackingRoutes
);

// Customer routes - Specific routes MUST be registered before general /customer route
// to prevent Express from matching the broader route first
router.use("/customer/products", customerProductRoutes);
router.use("/customer/categories", customerCategoryRoutes);

// Tracking routes (must be before general /customer/orders/:id route)
router.use("/customer", customerTrackingRoutes);

// Customer orders route - direct registration to avoid module loading issue
console.log("🔥 REGISTERING CUSTOMER ORDER ROUTES");
router.post(
  "/customer/orders",
  (_req, _res, next) => {
    console.log("✅ POST /customer/orders ROUTE MATCHED!");
    next();
  },
  authenticate,
  requireUserType("Customer"),
  createOrder
);
router.post("/customer/orders/initiate", authenticate, requireUserType("Customer"), initiateOnlineOrder);
router.post("/customer/orders/verify-payment", authenticate, requireUserType("Customer"), verifyOnlinePayment);
router.get("/customer/orders", authenticate, requireUserType("Customer"), getMyOrders);
router.get("/customer/orders/:id", authenticate, requireUserType("Customer"), getOrderById);
router.post("/customer/orders/:id/cancel", authenticate, requireUserType("Customer"), cancelOrder);
router.patch("/customer/orders/:id/notes", authenticate, requireUserType("Customer"), updateOrderNotes);
router.post("/customer/orders/return-replace", authenticate, requireUserType("Customer"), requestReturnOrReplace);

router.use("/customer/coupons", customerCouponRoutes);
router.use("/customer/addresses", customerAddressRoutes);
router.use("/customer/home", customerHomeRoutes);
router.use("/customer/cart", customerCartRoutes);
router.use("/customer/wishlist", wishlistRoutes);
router.use("/customer/reviews", productReviewRoutes);
// General customer route (must be last to avoid intercepting specific routes)
// ... other imports
import customerVideoRoutes from "./customerVideoRoutes";

// ... existing code ...

// General customer route (must be last to avoid intercepting specific routes)
router.use("/customer/video-finds", customerVideoRoutes);

import customerFreeGiftRoutes from "./customerFreeGiftRoutes";
router.use("/customer/free-gift-rules", customerFreeGiftRoutes);

// Public Config Route
import { getPublicConfig } from "../modules/customer/controllers/customerConfigController";
router.get("/customer/config", getPublicConfig);

router.use("/customer", customerRoutes);

// ... existing code ...


// Seller dashboard routes
router.use("/seller/dashboard", dashboardRoutes);

// Seller management routes (protected, admin only)
router.use("/sellers", sellerRoutes);

// Admin routes (protected, admin only)
router.use("/admin", adminRoutes);

// Upload routes (protected)
router.use("/upload", uploadRoutes);

// Product routes (protected, seller only)
router.use("/products", productRoutes);

// Category routes (protected, seller/admin)
router.use("/categories", categoryRoutes);

// Header Category Routes
router.use("/header-categories", headerCategoryRoutes);

// Order routes (protected, seller only)
router.use("/orders", orderRoutes);

// Return routes (protected, seller only)
router.use("/returns", returnRoutes);

// Report routes (protected, seller only)
router.use("/seller/reports", reportRoutes);

// Wallet routes (protected, seller only)
router.use("/seller/wallet", walletRoutes);

// POS dedicated routes
import { getPOSProducts } from "../modules/admin/controllers/adminProductController";
router.get("/pos/products", authenticate, requireUserType("Admin"), getPOSProducts);

// Tax routes (protected, seller/admin)
router.use("/seller/taxes", taxRoutes);

// Add more routes here
// router.use('/users', userRoutes);

// Banner routes (public read, admin write)
router.use("/banners", bannerRoutes);
router.use("/flash-deals", flashDealRoutes);

// Notification routes
router.use("/notification", fcmRoutes);

export default router;
