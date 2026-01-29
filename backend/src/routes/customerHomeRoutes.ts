import { Router } from "express";
import { getHomeContent, getStoreProducts } from "../modules/customer/controllers/customerHomeController";

const router = Router();

// Public routes
router.get("/", getHomeContent);
router.get("/store/:storeId", getStoreProducts);

export default router;
