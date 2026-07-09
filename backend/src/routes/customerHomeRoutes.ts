import { Router } from "express";
import { getHomeContent, getStoreProducts, getLowestPricesProducts } from "../modules/customer/controllers/customerHomeController";

const router = Router();

// Public routes
router.get("/", getHomeContent);
router.get("/lowest-prices", getLowestPricesProducts);
router.get("/store/:storeId", getStoreProducts);

export default router;
