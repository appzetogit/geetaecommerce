import mongoose from "mongoose";
import dotenv from "dotenv";
import Seller from "../models/Seller";

dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb+srv://playeronline4076_db_user:ChbhODdCbgE2d2VV@cluster0.qyctmev.mongodb.net/geeta-ecom?retryWrites=true&w=majority&appName=Cluster0";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
  
  const sellers = await Seller.find().select("mobile email name businessName isEnabled");
  console.log("Sellers count:", sellers.length);
  console.log("Sellers list:", JSON.stringify(sellers, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
