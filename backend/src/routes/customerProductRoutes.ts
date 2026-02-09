import { Router } from "express";
import { getProducts, getProductById, getAllBrands, getBrandDetails, getSearchSuggestions } from "../modules/customer/controllers/customerProductController";

const router = Router();

// Public routes (no auth required for viewing products)
router.get("/brands", getAllBrands);
router.get("/brands/:id", getBrandDetails);
router.get("/suggestions", getSearchSuggestions);
router.get("/", getProducts);
router.get("/:id", getProductById);

export default router;
