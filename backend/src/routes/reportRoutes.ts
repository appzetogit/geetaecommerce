import { Router } from "express";
import {
  getSalesReport,
  getGSTSalesReport,
  getPaymentReport,
  getSalesSummaryReport,
  getReturnExchangeReport,
  getStockSalesSummary,
  getDueSummaryReport
} from "../modules/seller/controllers/reportController";
import { authenticate, requireUserType, checkEnabled } from "../middleware/auth";

const router = Router();

// All routes require authentication and seller user type
router.use(authenticate);
router.use(requireUserType("Seller"));
router.use(checkEnabled);
// Get seller's sales report
router.get("/sales", getSalesReport);
router.get("/gst-sales", getGSTSalesReport);
router.get("/payment", getPaymentReport);
router.get("/sales-summary", getSalesSummaryReport);
router.get("/return-exchange", getReturnExchangeReport);
router.get("/stock-sales-summary", getStockSalesSummary);
router.get("/due-summary", getDueSummaryReport);

export default router;
