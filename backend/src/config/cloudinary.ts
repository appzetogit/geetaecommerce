import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Validate configuration
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.warn("⚠️  Cloudinary credentials not found in environment variables");
}

export default cloudinary;

// Folder structure constants
export const CLOUDINARY_FOLDERS = {
  PRODUCTS: "Geeta Stores/products",
  PRODUCT_GALLERY: "Geeta Stores/products/gallery",
  CATEGORIES: "Geeta Stores/categories",
  SUBCATEGORIES: "Geeta Stores/subcategories",
  COUPONS: "Geeta Stores/coupons",
  SELLERS: "Geeta Stores/sellers",
  SELLER_PROFILE: "Geeta Stores/sellers/profile",
  SELLER_DOCUMENTS: "Geeta Stores/sellers/documents",
  DELIVERY: "Geeta Stores/delivery",
  DELIVERY_DOCUMENTS: "Geeta Stores/delivery/documents",
  STORES: "Geeta Stores/stores",
  USERS: "Geeta Stores/users",
} as const;
