/**
 * Migrates existing products to variant-first model.
 *
 * Usage:
 *   npx tsx src/scripts/migrateProductVariantModel.ts [--dry-run]
 *
 * Produces migration-audit.csv in the current working directory.
 */
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../models/Product";
import Inventory from "../models/Inventory";
import { normalizeVariant } from "../modules/product/variantHelpers";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");

interface AuditRow {
  productId: string;
  productName: string;
  action: string;
  notes: string;
}

const audit: AuditRow[] = [];

function log(msg: string) {
  console.log(`[migrate] ${msg}`);
}

async function migrateProduct(product: any): Promise<void> {
  const id = String(product._id);
  const name = product.productName || "";
  let variations = Array.isArray(product.variations) ? [...product.variations] : [];
  const productLevelType = product.variationType || "Standard";

  if (variations.length === 0) {
    variations = [
      normalizeVariant({
        variationType: productLevelType,
        value: "Default",
        price: product.price ?? 1,
        discPrice: product.discPrice ?? product.price ?? 1,
        compareAtPrice: product.compareAtPrice,
        wholesalePrice: product.wholesalePrice,
        purchasePrice: product.purchasePrice,
        stock: product.stock ?? 0,
        sku: product.sku,
        barcode: product.barcode,
        rackNumber: product.rackNumber,
        mainImage: product.mainImage,
        galleryImages: product.galleryImages,
        tieredPrices: product.unitPricing,
      }),
    ];
    audit.push({
      productId: id,
      productName: name,
      action: "created_default_variant",
      notes: "From root price/stock/images",
    });
  } else {
    variations = variations.map((v: any) => {
      const normalized = normalizeVariant({
        ...v,
        variationType: v.variationType || productLevelType || v.name || "Standard",
        value: v.value || v.title || "Default",
        mainImage: v.mainImage || v.image || product.mainImage,
        galleryImages:
          v.galleryImages?.length > 0
            ? v.galleryImages
            : product.galleryImages?.length > 0
              ? product.galleryImages
              : [],
        price: v.price ?? product.price ?? 1,
        stock: v.stock ?? product.stock ?? 0,
        sku: v.sku || product.sku,
        barcode: v.barcode?.length ? v.barcode : product.barcode,
        rackNumber: v.rackNumber || product.rackNumber,
      });
      return normalized;
    });
    audit.push({
      productId: id,
      productName: name,
      action: "normalized_variants",
      notes: `count=${variations.length}`,
    });
  }

  const inventory = await Inventory.findOne({ product: product._id }).lean();
  if (inventory && variations.length === 1) {
    const invStock = Number(inventory.currentStock) || 0;
    if ((variations[0].stock ?? 0) === 0 && invStock > 0) {
      variations[0].stock = invStock;
      audit.push({
        productId: id,
        productName: name,
        action: "inventory_to_variant",
        notes: `stock=${invStock}`,
      });
    }
  } else if (inventory && variations.length > 1) {
    audit.push({
      productId: id,
      productName: name,
      action: "manual_review",
      notes: `Multi-variant product with Inventory row stock=${inventory.currentStock}`,
    });
  }

  const update: Record<string, unknown> = {
    variations: variations.map((v) => ({
      variationType: v.variationType,
      value: v.value,
      name: v.name,
      price: v.price,
      discPrice: v.discPrice,
      compareAtPrice: v.compareAtPrice,
      wholesalePrice: v.wholesalePrice,
      purchasePrice: v.purchasePrice,
      stock: v.stock,
      status: v.status,
      sku: v.sku,
      barcode: v.barcode,
      rackNumber: v.rackNumber,
      mainImage: v.mainImage,
      galleryImages: v.galleryImages,
      image: v.mainImage,
      tieredPrices: v.tieredPrices,
    })),
    $unset: {
      price: "",
      discPrice: "",
      compareAtPrice: "",
      wholesalePrice: "",
      purchasePrice: "",
      stock: "",
      mainImage: "",
      galleryImages: "",
      sku: "",
      barcode: "",
      rackNumber: "",
      variationType: "",
      unitPricing: "",
    },
  };

  if (!DRY_RUN) {
    await Product.updateOne({ _id: product._id }, update);
  }
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  log(`Connected (dryRun=${DRY_RUN})`);

  const products = await Product.find({}).lean();
  log(`Found ${products.length} products`);

  for (const product of products) {
    try {
      await migrateProduct(product);
    } catch (err: any) {
      audit.push({
        productId: String(product._id),
        productName: product.productName || "",
        action: "error",
        notes: err.message,
      });
    }
  }

  const csvPath = path.join(process.cwd(), "migration-audit.csv");
  const header = "productId,productName,action,notes\n";
  const rows = audit
    .map(
      (r) =>
        `"${r.productId}","${r.productName.replace(/"/g, '""')}","${r.action}","${r.notes.replace(/"/g, '""')}"`
    )
    .join("\n");
  fs.writeFileSync(csvPath, header + rows);
  log(`Audit written to ${csvPath}`);
  log(`Done. ${audit.length} audit rows.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
