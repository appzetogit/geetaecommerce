import { Router } from "express";
import {
  getOrders,
  getOrderById,
  updateOrderStatus,
} from "../modules/seller/controllers/orderController";
import { authenticate, requireUserType, checkEnabled } from "../middleware/auth";

const router = Router();

// All routes require authentication and seller user type
router.use(authenticate);
router.use(requireUserType("Seller"));
router.use(checkEnabled);

// Get seller's orders with filters
router.get("/", getOrders);

// Get order by ID
router.get("/:id", getOrderById);

// Update order status
router.patch("/:id/status", updateOrderStatus);

export default router;
