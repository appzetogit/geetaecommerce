import dotenv from "dotenv";
import connectDB from "../config/db";
import Product, { buildProductSearchText } from "../models/Product";
import "../models/Category";
import "../models/SubCategory";
import "../models/Brand";
import { generateEmbedding } from "../utils/embedding";

dotenv.config();

const batchSize = Number(process.env.SEARCH_EMBEDDING_BACKFILL_BATCH || 25);

const backfillProductEmbeddings = async () => {
  await connectDB();

  const filter = {
    $or: [
      { embedding: { $exists: false } },
      { embedding: { $size: 0 } },
      { "searchMetadata.version": { $ne: 1 } },
    ],
  };

  const total = await Product.countDocuments(filter);
  console.log(`[EmbeddingBackfill] ${total} products need embeddings`);

  let processed = 0;
  let updated = 0;

  while (processed < total) {
    const products = await Product.find(filter)
      .select("+embedding +searchMetadata")
      .limit(batchSize);

    if (products.length === 0) break;

    for (const product of products) {
      processed += 1;
      try {
        const sourceText = await buildProductSearchText(product);
        if (!sourceText) continue;

        const embedding = await generateEmbedding(sourceText);
        await Product.updateOne(
          { _id: product._id },
          {
            $set: {
              embedding,
              searchMetadata: {
                sourceText,
                model: "Xenova/all-MiniLM-L6-v2",
                dimensions: embedding.length,
                updatedAt: new Date(),
                version: 1,
              },
            },
          }
        );
        updated += 1;
      } catch (error) {
        console.error(`[EmbeddingBackfill] Failed for product ${product._id}`, error);
      }
    }

    console.log(`[EmbeddingBackfill] processed=${processed} updated=${updated}/${total}`);
  }

  console.log(`[EmbeddingBackfill] Done. Updated ${updated} products.`);
  process.exit(0);
};

backfillProductEmbeddings().catch((error) => {
  console.error("[EmbeddingBackfill] Failed", error);
  process.exit(1);
});
