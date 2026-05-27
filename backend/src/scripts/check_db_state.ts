import dotenv from "dotenv";
import connectDB from "../config/db";
import Product from "../models/Product";
import { hybridProductSearch } from "../services/searchService";

dotenv.config();

async function run() {
  console.log("Connecting to database using:", process.env.MONGODB_URI);
  await connectDB();
  
  const totalProducts = await Product.countDocuments({});
  const activeProducts = await Product.countDocuments({ status: "Active", publish: true });
  const productsWithEmbeddings = await Product.countDocuments({
    embedding: { $exists: true, $not: { $size: 0 } }
  });
  const productsWithoutEmbeddings = await Product.countDocuments({
    $or: [
      { embedding: { $exists: false } },
      { embedding: { $size: 0 } }
    ]
  });

  console.log("--- PRODUCT STATS ---");
  console.log("Total Products:", totalProducts);
  console.log("Active & Published Products:", activeProducts);
  console.log("Products with Embeddings:", productsWithEmbeddings);
  console.log("Products without Embeddings:", productsWithoutEmbeddings);

  console.log("\n--- TESTING HYBRID SEARCH FOR 'pencil' ---");
  try {
    const searchRes = await hybridProductSearch({
      query: "pencil",
      page: 1,
      limit: 10,
      sort: "relevance"
    });
    console.log(`Found ${searchRes.pagination.total} results.`);
    searchRes.results.slice(0, 5).forEach((p: any, idx: number) => {
      console.log(`${idx + 1}. Name: "${p.productName}" (ID: ${p._id})`);
      console.log(`   Stock: ${p.stock}, Price: ${p.price}`);
      console.log(`   Scores:`, p.searchScore);
      console.log(`   Embedding present: ${Array.isArray(p.embedding) && p.embedding.length > 0}`);
    });
  } catch (error) {
    console.error("Hybrid search failed:", error);
  }

  process.exit(0);
}

run().catch(err => {
  console.error("Run failed:", err);
  process.exit(1);
});
