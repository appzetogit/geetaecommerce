import express from "express";
import { authenticate, requireUserType, checkEnabled } from "../middleware/auth";
import {
  getStockSummary,
  getStockBalanceSummary,
  getLowStockSummary,
  getOutOfStockSummary,
  getLossSummary,
  createLossRecord,
  deleteLossRecord
} from "../modules/seller/controllers/inventoryController";

const router = express.Router();

// Apply auth middleware
router.use(authenticate);
router.use(requireUserType("Seller"));
router.use(checkEnabled);

router.get("/stock-summary", getStockSummary);
router.get("/stock-balance", getStockBalanceSummary);
router.get("/low-stock", getLowStockSummary);
router.get("/out-of-stock", getOutOfStockSummary);
router.get("/loss-summary", getLossSummary);
router.post("/loss", createLossRecord);
router.delete("/loss/:id", deleteLossRecord);

export default router;
