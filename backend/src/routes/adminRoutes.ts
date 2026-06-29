import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import { uploadMultipleDocuments } from "../middleware/upload";

// Dashboard Controllers
import * as dashboardController from "../modules/admin/controllers/adminDashboardController";

// Product Controllers
import * as productController from "../modules/admin/controllers/adminProductController";

// Order Controllers
import * as orderController from "../modules/admin/controllers/adminOrderController";
import * as deletePOSOrderController from "../modules/admin/controllers/deletePOSOrderController";
import * as deleteOrderController from "../modules/admin/controllers/deleteOrderController";
import * as updateStockLedgerController from "../modules/admin/controllers/updateStockLedgerController";
import * as inventoryController from "../modules/admin/controllers/adminInventoryController";
import * as adminPOSPurchaseEntryController from "../modules/admin/controllers/adminPOSPurchaseEntryController";

// Customer Controllers
import * as customerController from "../modules/admin/controllers/adminCustomerController";
import * as abandonedCartController from "../modules/admin/controllers/adminAbandonedCartController";

// Delivery Controllers
import * as deliveryController from "../modules/admin/controllers/adminDeliveryController";

// Settings Controllers
import * as settingsController from "../modules/admin/controllers/adminSettingsController";

// Coupon Controllers
import * as couponController from "../modules/admin/controllers/adminCouponController";

// Notification Controllers
import * as notificationController from "../modules/admin/controllers/adminNotificationController";

// Wallet Controllers
import * as walletController from "../modules/admin/controllers/adminWalletController";

// Tax Controllers
import * as taxController from "../modules/admin/controllers/adminTaxController";

// Cash Collection Controllers
import * as cashCollectionController from "../modules/admin/controllers/adminCashCollectionController";

// FAQ Controllers
import * as faqController from "../modules/admin/controllers/adminFAQController";

// Role Controllers
import * as roleController from "../modules/admin/controllers/adminRoleController";

import * as paymentController from "../modules/admin/controllers/adminPaymentController";
import * as policyController from "../modules/admin/controllers/adminPolicyController";
import * as sellerController from "../modules/admin/controllers/adminSellerController";

// Profile Controllers
import * as profileController from "../modules/admin/controllers/adminProfileController";

// Shop Controllers (Shop by Store)
import {
  createShop,
  getAllShops,
  getShopById,
  updateShop,
  deleteShop,
} from "../modules/admin/controllers/adminShopController";

// System User Controllers
import * as systemUserController from "../modules/admin/controllers/adminSystemUserController";

// Home Section Controllers
import * as homeSectionController from "../modules/admin/controllers/adminHomeSectionController";

// Bestseller Card Controllers
import * as bestsellerCardController from "../modules/admin/controllers/adminBestsellerCardController";

// Lowest Prices Controllers
import * as lowestPricesController from "../modules/admin/controllers/adminLowestPricesController";

// PromoStrip Controllers
import * as promoStripController from "../modules/admin/controllers/adminPromoStripController";

// Staff Controllers
import * as staffController from "../modules/admin/controllers/adminStaffController";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Settings Routes (Accessible to all authenticated users - Sellers need this)
router.get("/settings", settingsController.getAppSettings);
router.put("/settings", requireUserType("Admin", "Seller"), settingsController.updateAppSettings);

// Staff routes are required for both Admin and Seller modules (e.g. seller staff-login flow)
router.get("/staff", requireUserType("Admin", "Seller"), staffController.getStaffList);
router.post("/staff", requireUserType("Admin", "Seller"), staffController.createStaff);
router.put("/staff/:id", requireUserType("Admin", "Seller"), staffController.updateStaff);
router.delete("/staff/:id", requireUserType("Admin", "Seller"), staffController.deleteStaff);

// Order Edit (POS) - Accessible to both Admin and Seller
router.patch("/orders/:id/items", requireUserType("Admin", "Seller"), orderController.updateOrderItems);

router.use(requireUserType("Admin"));

// ==================== Profile Routes ====================
router.get("/profile", profileController.getProfile);
router.put("/profile", profileController.updateProfile);

// ==================== Dashboard Routes ====================
router.get("/dashboard/stats", dashboardController.getDashboardStatsController);
router.get(
  "/dashboard/analytics",
  dashboardController.getSalesAnalyticsController
);
router.get(
  "/dashboard/top-sellers",
  dashboardController.getTopSellersController
);
router.get(
  "/dashboard/recent-orders",
  dashboardController.getRecentOrdersController
);
router.get(
  "/dashboard/sales-by-location",
  dashboardController.getSalesByLocationController
);
router.get(
  "/dashboard/today-sales",
  dashboardController.getTodaySalesController
);
router.get(
  "/dashboard/order-analytics",
  dashboardController.getOrderAnalyticsController
);
router.get(
  "/dashboard/sales-summary",
  dashboardController.getSalesSummaryController
);

// ==================== Category Routes ====================
router.post("/categories", productController.createCategory);
router.get("/categories", productController.getCategories);
router.put("/categories/:id", productController.updateCategory);
router.delete("/categories/:id", productController.deleteCategory);
router.patch("/categories/:id/status", productController.toggleCategoryStatus);
router.post("/categories/bulk-delete", productController.bulkDeleteCategories);
router.put("/categories/reorder", productController.updateCategoryOrder);

// ==================== SubCategory Routes ====================
router.post("/subcategories", productController.createSubCategory);
router.get("/subcategories", productController.getSubCategories);
router.put("/subcategories/:id", productController.updateSubCategory);
router.delete("/subcategories/:id", productController.deleteSubCategory);

// ==================== Brand Routes ====================
router.post("/brands", productController.createBrand);
router.get("/brands", productController.getBrands);
router.put("/brands/:id", productController.updateBrand);
router.delete("/brands/:id", productController.deleteBrand);

// ==================== Product Routes ====================
router.post("/products", productController.createProduct);
router.get("/products/pos", productController.getPOSProducts);
router.get("/products", productController.getProducts);
// Product order functionality removed
// router.put("/products/order", productController.updateProductOrder);
router.get("/products/:id", productController.getProductById);
router.put("/products/:id", productController.updateProduct);
router.delete("/products/:id", productController.deleteProduct);
// Product approval no longer needed - products show directly in list
// router.patch("/products/:id/approve", productController.approveProductRequest);
router.post("/products/bulk-import", productController.bulkImportProducts);
router.put("/products/bulk-update", productController.bulkUpdateProducts);
// One-shot reconciliation: copy headerCategoryId from each product's Category
// onto the product itself (for items created before that auto-inheritance was
// added). POST so admins can run it from the UI / postman with a dryRun flag.
router.post(
  "/products/backfill-header-category",
  productController.backfillProductHeaderCategory
);

// ==================== Inventory Routes ====================
router.get("/inventory/stock-summary", inventoryController.getStockSummary);
router.get("/inventory/stock-balance", inventoryController.getStockBalanceSummary);
router.get("/inventory/low-stock", inventoryController.getLowStockSummary);
router.get("/inventory/out-of-stock", inventoryController.getOutOfStockSummary);
router.get("/inventory/loss-summary", inventoryController.getLossSummary);
router.get("/inventory/gst-sales", inventoryController.getGSTSalesReport);
router.delete("/inventory/gst-sales", inventoryController.deleteGSTSalesReportEntries);
router.get("/inventory/payment-report", inventoryController.getPaymentReport);
router.get("/inventory/sales-summary-report", inventoryController.getSalesSummaryReport);
router.get("/inventory/return-exchange-report", inventoryController.getReturnExchangeReport);
router.get("/inventory/stock-sales-summary", inventoryController.getStockSalesSummary);
router.get("/inventory/due-summary", inventoryController.getDueSummaryReport);
router.post("/inventory/loss", inventoryController.createLossRecord);
router.delete("/inventory/loss/:id", inventoryController.deleteLossRecord);

// ==================== POS Routes ====================
router.post("/orders/pos", orderController.createPOSOrder);
router.post("/orders/pos/online", orderController.initiatePOSOnlineOrder);
router.post("/orders/pos/verify", orderController.verifyPOSPayment);
router.get("/pos/report", orderController.getPOSReport);
router.get("/pos/stock-ledger", orderController.getPOSStockLedger);
router.put("/pos/stock-ledger/:id", updateStockLedgerController.updateStockLedgerEntry);
router.post("/pos/exchange", orderController.processPOSExchange);
router.delete("/orders/pos/:id", deletePOSOrderController.deletePOSOrder);
router.get("/pos/purchase-entries", adminPOSPurchaseEntryController.getAdminPurchaseEntries);
router.post("/pos/purchase-entries", adminPOSPurchaseEntryController.upsertAdminPurchaseEntry);
router.delete("/pos/purchase-entries/:entryId", adminPOSPurchaseEntryController.deleteAdminPurchaseEntry);

// ==================== Order Routes ====================
router.get("/orders/pos-report", orderController.getPOSOrders);
router.get("/orders/online", orderController.getOnlineOrders);
router.get("/orders", orderController.getAllOrders);
router.get("/orders/status/:status", orderController.getOrdersByStatus);
router.get("/orders/:id", orderController.getOrderById);
router.delete("/orders/:id", deleteOrderController.deleteOrder);
router.patch("/orders/:id/status", orderController.updateOrderStatus);
// router.patch("/orders/:id/items", orderController.updateOrderItems); // Moved up to allow Sellers
router.patch("/orders/:id/assign-delivery", orderController.assignDeliveryBoy);
router.get("/orders/export/csv", orderController.exportOrders);

// ==================== POS Credit Routes ====================
import * as creditController from "../modules/admin/controllers/adminCreditController";

router.get("/pos/credit/customers", creditController.getCreditCustomers);
router.get("/pos/credit/history/:customerId", creditController.getCustomerHistory);
router.post("/pos/credit/add", creditController.addCredit);
router.post("/pos/credit/payment", creditController.acceptPayment);
router.post("/pos/credit/payment/initiate", creditController.initiateCreditPayment);
router.post("/pos/credit/payment/verify", creditController.verifyCreditPayment);

// ==================== POS Supplier Ledger Routes ====================
import * as supplierController from "../modules/admin/controllers/adminSupplierController";
router.get("/pos/suppliers", supplierController.getAllSuppliers);
router.get("/pos/suppliers/:id", supplierController.getSupplierById);
router.post("/pos/suppliers", supplierController.createSupplier);
router.put("/pos/suppliers/:id", supplierController.updateSupplier);
router.delete("/pos/suppliers/:id", supplierController.deleteSupplier);
router.post("/pos/suppliers/:id/debt", supplierController.addDebt);
router.post("/pos/suppliers/:id/pay", supplierController.paySupplier);

// ==================== Custom GST Report (Purchase GST Register) Routes ====================
import * as adminGSTReportController from "../modules/admin/controllers/adminGSTReportController";
router.get("/reports/gst-register", adminGSTReportController.listGSTReport);
router.post("/reports/gst-register", adminGSTReportController.createGSTReportEntry);
router.patch("/reports/gst-register/:id", adminGSTReportController.updateGSTReportEntry);
router.delete("/reports/gst-register/:id", adminGSTReportController.deleteGSTReportEntry);

// ==================== Return Request Routes ====================
router.get("/return-requests", orderController.getReturnRequests);
router.get("/return-requests/:id", orderController.getReturnRequestById);
router.put("/return-requests/:id", orderController.processReturnRequest);
// Legacy route support if needed, but frontend uses /return-requests
router.patch("/returns/:id/process", orderController.processReturnRequest);

// ==================== Customer Routes ====================
router.post("/customers", customerController.createCustomer);
router.get("/customers/abandoned-carts", abandonedCartController.getAbandonedCarts);
router.get("/customers", customerController.getAllCustomers);
router.get("/customers/:id", customerController.getCustomerById);
router.patch("/customers/:id/status", customerController.updateCustomerStatus);
router.get("/customers/:id/orders", customerController.getCustomerOrders);
router.delete("/customers/:id", customerController.deleteCustomer);

// ==================== Delivery Routes ====================
router.post("/delivery", deliveryController.createDeliveryBoy);
router.get("/delivery", deliveryController.getAllDeliveryBoys);
router.get("/delivery/:id", deliveryController.getDeliveryBoyById);
router.put("/delivery/:id", deliveryController.updateDeliveryBoy);
router.patch("/delivery/:id/status", deliveryController.updateDeliveryStatus);
router.patch(
  "/delivery/:id/availability",
  deliveryController.updateDeliveryBoyAvailability
);
router.delete("/delivery/:id", deliveryController.deleteDeliveryBoy);
router.get(
  "/delivery/:id/assignments",
  deliveryController.getDeliveryAssignments
);
router.post("/delivery/:id/collect-cash", deliveryController.collectCash);
router.get(
  "/delivery/:id/cash-collections",
  deliveryController.getDeliveryBoyCashCollections
);

// ==================== Payment Routes ====================
router.get("/payment-methods", paymentController.getPaymentMethods);
router.get("/payment-methods/:id", paymentController.getPaymentMethodById);
router.put("/payment-methods/:id", paymentController.updatePaymentMethod);
router.patch(
  "/payment-methods/:id/status",
  paymentController.updatePaymentMethodStatus
);

// ==================== Settings Routes ====================
// router.get("/settings", settingsController.getAppSettings); // Moved to top
// router.put("/settings", settingsController.updateAppSettings); // Moved to top
router.get("/settings/payment-methods", settingsController.getPaymentMethods);
router.put(
  "/settings/payment-methods",
  settingsController.updatePaymentMethods
);
router.get("/settings/sms-gateway", settingsController.getSMSGatewaySettings);
router.put(
  "/settings/sms-gateway",
  settingsController.updateSMSGatewaySettings
);

// ==================== Coupon Routes ====================
router.post("/coupons", couponController.createCoupon);
router.get("/coupons", couponController.getCoupons);
router.get("/coupons/:id", couponController.getCouponById);
router.put("/coupons/:id", couponController.updateCoupon);
router.delete("/coupons/:id", couponController.deleteCoupon);
router.post("/coupons/validate", couponController.validateCoupon);

// ==================== Notification Routes ====================
router.post("/notifications", notificationController.createNotification);
router.get("/notifications", notificationController.getNotifications);
router.get("/notifications/:id", notificationController.getNotificationById);
router.put("/notifications/:id", notificationController.updateNotification);
router.delete("/notifications/:id", notificationController.deleteNotification);
router.post("/notifications/:id/send", notificationController.sendNotification);
router.patch("/notifications/:id/read", notificationController.markAsRead);
router.patch(
  "/notifications/read-all",
  notificationController.markMultipleAsRead
);
router.patch(
  "/notifications/mark-read",
  notificationController.markMultipleAsRead
); // Legacy support

// ==================== Wallet Routes ====================
router.get("/wallet/transactions", walletController.getWalletTransactions);
router.get("/wallet/seller-commissions", walletController.getSellerCommissions);
router.post("/wallet/manual-fund-transfer", walletController.createAdminWalletTransaction);
router.post("/wallet/transfer", walletController.processFundTransfer);
router.get("/wallet/seller/:sellerId", walletController.getSellerTransactions);
router.post("/wallet/withdrawal", walletController.processWithdrawal);
router.get("/wallet/withdrawals", walletController.getWithdrawalRequests);
router.put("/wallet/withdrawals/:id", walletController.updateWithdrawalStatus);

// ==================== Financial Dashboard Routes ====================
router.get("/financial/dashboard", walletController.getFinancialDashboard);
router.get("/financial/order-transactions", walletController.getAllOrderTransactions);
router.get("/financial/delivery-charges", walletController.getDeliveryChargesReport);

// ==================== Tax Routes ====================
router.get("/taxes", taxController.getTaxes);
router.get("/taxes/:id", taxController.getTaxById);
router.post("/taxes", taxController.createTax);
router.put("/taxes/:id", taxController.updateTax);
router.patch("/taxes/:id/status", taxController.updateTaxStatus);
router.delete("/taxes/:id", taxController.deleteTax);

// ==================== Cash Collection Routes ====================
router.get("/cash-collections", cashCollectionController.getCashCollections);
router.get(
  "/cash-collections/:id",
  cashCollectionController.getCashCollectionById
);
router.post("/cash-collections", cashCollectionController.createCashCollection);
router.put(
  "/cash-collections/:id",
  cashCollectionController.updateCashCollection
);
router.delete(
  "/cash-collections/:id",
  cashCollectionController.deleteCashCollection
);

// ==================== FAQ Routes ====================
router.get("/faqs", faqController.getFAQs);
router.get("/faqs/:id", faqController.getFAQById);
router.post("/faqs", faqController.createFAQ);
router.put("/faqs/:id", faqController.updateFAQ);
router.patch("/faqs/:id/status", faqController.updateFAQStatus);
router.delete("/faqs/:id", faqController.deleteFAQ);
router.put("/faqs/order", faqController.updateFAQOrder);

// ==================== Role Routes ====================
router.get("/roles", roleController.getRoles);
router.get("/roles/:id", roleController.getRoleById);
router.post("/roles", roleController.createRole);
router.put("/roles/:id", roleController.updateRole);
router.delete("/roles/:id", roleController.deleteRole);

// ==================== Policy Routes ====================
router.post("/policies", policyController.createPolicy);
router.get("/policies", policyController.getPolicies);
router.put("/policies/:id", policyController.updatePolicy);
router.delete("/policies/:id", policyController.deletePolicy);

// ==================== Seller Routes ====================
router.get("/sellers", sellerController.getAllSellers);
router.post(
  "/sellers",
  uploadMultipleDocuments.fields([
    { name: "profile", maxCount: 1 },
    { name: "idProof", maxCount: 1 },
    { name: "addressProof", maxCount: 1 },
  ]),
  sellerController.createSeller
);
router.patch("/sellers/:id/toggle-status", sellerController.toggleSellerEnabled);

// ==================== Shop Management ====================
// Legacy routes (keep for backward compatibility)
router.post("/shop/create", createShop);
router.get("/shops", getAllShops);
router.get("/shop/:id", getShopById);
router.put("/shop/:id", updateShop);
router.delete("/shop/:id", deleteShop);

// Shop by Store routes (matching frontend API expectations)
router.post("/shop-by-stores", createShop);
router.get("/shop-by-stores", getAllShops);
router.get("/shop-by-stores/:id", getShopById);
router.put("/shop-by-stores/:id", updateShop);
router.delete("/shop-by-stores/:id", deleteShop);

// ==================== System User Routes ====================
router.get("/system-users", systemUserController.getAllSystemUsers);
router.get("/system-users/:id", systemUserController.getSystemUserById);
router.post("/system-users", systemUserController.createSystemUser);
router.put("/system-users/:id", systemUserController.updateSystemUser);
router.delete("/system-users/:id", systemUserController.deleteSystemUser);

// ==================== Home Section Routes ====================
router.get("/home-sections", homeSectionController.getHomeSections);
router.get("/home-sections/:id", homeSectionController.getHomeSectionById);
router.post("/home-sections", homeSectionController.createHomeSection);
router.put("/home-sections/:id", homeSectionController.updateHomeSection);
router.delete("/home-sections/:id", homeSectionController.deleteHomeSection);
router.put("/home-sections/reorder", homeSectionController.reorderHomeSections);

// ==================== Bestseller Card Routes ====================
router.get("/bestseller-cards", bestsellerCardController.getBestsellerCards);
router.get("/bestseller-cards/:id", bestsellerCardController.getBestsellerCardById);
router.post("/bestseller-cards", bestsellerCardController.createBestsellerCard);
router.put("/bestseller-cards/:id", bestsellerCardController.updateBestsellerCard);
router.delete("/bestseller-cards/:id", bestsellerCardController.deleteBestsellerCard);
router.put("/bestseller-cards/reorder", bestsellerCardController.reorderBestsellerCards);

// ==================== Lowest Prices Product Routes ====================
router.get("/lowest-prices-products", lowestPricesController.getLowestPricesProducts);
router.get("/lowest-prices-products/:id", lowestPricesController.getLowestPricesProductById);
router.post("/lowest-prices-products", lowestPricesController.createLowestPricesProduct);
router.put("/lowest-prices-products/:id", lowestPricesController.updateLowestPricesProduct);
router.delete("/lowest-prices-products/:id", lowestPricesController.deleteLowestPricesProduct);
router.put("/lowest-prices-products/reorder", lowestPricesController.reorderLowestPricesProducts);

// ==================== PromoStrip Routes ====================
router.get("/promo-strips", promoStripController.getAllPromoStrips);
router.get("/promo-strips/:id", promoStripController.getPromoStripById);
router.post("/promo-strips", promoStripController.createPromoStrip);
router.put("/promo-strips/:id", promoStripController.updatePromoStrip);
router.delete("/promo-strips/:id", promoStripController.deletePromoStrip);

// ==================== Video Finds Routes ====================
import * as videoFindController from "../modules/admin/controllers/adminVideoFindController";

router.get("/video-finds", videoFindController.getVideoFinds);
router.post("/video-finds", videoFindController.createVideoFind);
router.put("/video-finds/:id", videoFindController.updateVideoFind);
router.delete("/video-finds/:id", videoFindController.deleteVideoFind);

// ==================== Attribute Routes ====================
import * as attributeController from "../modules/admin/controllers/adminAttributeController";

router.post("/attributes", attributeController.createAttribute);
router.get("/attributes", attributeController.getAttributes);
router.put("/attributes/:id", attributeController.updateAttribute);
router.delete("/attributes/:id", attributeController.deleteAttribute);

// ==================== Free Gift Rules Routes ====================
import * as freeGiftController from "../modules/admin/controllers/adminFreeGiftController";

router.post("/free-gift-rules", freeGiftController.createFreeGiftRule);
router.get("/free-gift-rules", freeGiftController.getFreeGiftRules);
router.put("/free-gift-rules/:id", freeGiftController.updateFreeGiftRule);
router.delete("/free-gift-rules/:id", freeGiftController.deleteFreeGiftRule);

export default router;
