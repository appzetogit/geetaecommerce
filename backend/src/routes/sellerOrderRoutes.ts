import { Router } from "express";
import {
  getOnlineOrders,
  getSellerPOSOrders,
} from "../modules/seller/controllers/orderController";
import { authenticate, requireUserType, checkEnabled } from "../middleware/auth";

const router = Router();

// All routes require authentication and seller user type
router.use(authenticate);
router.use(requireUserType("Seller"));
router.use(checkEnabled);

// Get online orders report
router.get("/online", getOnlineOrders);

// Get POS invoice report
router.get("/pos-report", getSellerPOSOrders);

export default router;
