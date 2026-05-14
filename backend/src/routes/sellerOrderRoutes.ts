import { Router } from "express";
import {
   getOnlineOrders,
   getSellerPOSOrders,
   getOrderById,
 } from "../modules/seller/controllers/orderController";
 import * as deletePOSOrderController from "../modules/admin/controllers/deletePOSOrderController";
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
 
 // Get POS order details
 router.get("/pos/:id", getOrderById);
 
 // Delete POS order and restore stock
 router.delete("/pos/:id", deletePOSOrderController.deletePOSOrder);

export default router;
