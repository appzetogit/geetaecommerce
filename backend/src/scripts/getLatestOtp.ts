import mongoose from "mongoose";
import dotenv from "dotenv";
import SellerOwnedSubCategory from "../models/SellerOwnedSubCategory";

dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb+srv://harshgemini:harshgemini123@cluster0.qyctmev.mongodb.net/geeta-ecom?retryWrites=true&w=majority";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
  
  const subcategories = await SellerOwnedSubCategory.find();
  console.log("SellerOwnedSubCategory count:", subcategories.length);
  console.log("Subcategories detail:", subcategories.map(s => ({
    _id: s._id.toString(),
    seller: s.seller?.toString(),
    parentId: s.parentId,
    parentIdType: typeof s.parentId,
    categoryName: s.categoryName,
    subcategoryName: s.subcategoryName
  })));
  
  await mongoose.disconnect();
}

main().catch(console.error);
