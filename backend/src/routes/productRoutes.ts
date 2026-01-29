import { Router } from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateStock,
  updateProductStatus,
  bulkUpdateStock,
  getShops,
} from "../modules/seller/controllers/productController";
import { getBrands } from "../modules/admin/controllers/adminProductController";
import { searchProductImage } from "../modules/seller/controllers/sellerToolsController";
import { authenticate, requireUserType, checkEnabled } from "../middleware/auth";

const router = Router();

// All routes require authentication and seller user type
router.use(authenticate);
router.use(requireUserType("Seller"));
router.use(checkEnabled);

// Get all brands - sellers need this for product creation
router.get("/brands", getBrands);

// Search image tool
router.post("/search-image", searchProductImage);

// Get all active shops - sellers need this for shop-by-store-only products
router.get("/shops", getShops);

// Create product
router.post("/", createProduct);

// Get seller's products with filters
router.get("/", getProducts);

// Get product by ID
router.get("/:id", getProductById);

// Update product
router.put("/:id", updateProduct);

// Delete product
router.delete("/:id", deleteProduct);

// Update stock for a product variation
router.patch("/:id/variations/:variationId/stock", updateStock);

// Bulk update stock
router.patch("/bulk-stock-update", bulkUpdateStock);

// Update product status (publish, popular, dealOfDay)
router.patch("/:id/status", updateProductStatus);

export default router;
