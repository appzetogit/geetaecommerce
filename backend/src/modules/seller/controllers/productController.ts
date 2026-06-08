import { Request, Response } from "express";
import Product from "../../../models/Product";
import Shop from "../../../models/Shop";
import Category from "../../../models/Category";
import Seller from "../../../models/Seller";
import { asyncHandler } from "../../../utils/asyncHandler";

/** Excel / bulk import often sends category or brand *names*; only valid 24-char hex IDs may be cast to ObjectId. */
function isValidObjectIdString(id: unknown): boolean {
  if (id == null) return false;
  const s = String(id).trim();
  return /^[a-fA-F0-9]{24}$/.test(s);
}

function stripInvalidObjectIdFields(body: Record<string, unknown>): void {
  const keys = [
    "categoryId",
    "subcategoryId",
    "brandId",
    "headerCategoryId",
    "sellerId",
    "shopId",
    "taxId",
  ] as const;
  for (const k of keys) {
    const v = body[k];
    if (v !== undefined && v !== null && v !== "" && !isValidObjectIdString(v)) {
      delete body[k];
    }
  }
}


/**
 * Create a new product
 */
export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const productData = req.body as Record<string, unknown>;
    stripInvalidObjectIdFields(productData);

    // Ensure sellerId matches authenticated seller
    if (productData.sellerId && productData.sellerId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: "You can only create products for your own account",
      });
    }

    // NOTE: There used to be a "Category Permission Guard" here that blocked
    // sellers with `canCreateCategories === true` from posting to any
    // admin-managed category or header. That had inverted polarity — the
    // flag's name describes an *additive* permission ("this seller may also
    // maintain their own private category tree"), not a restriction from
    // admin categories. The guard, combined with the schema default of
    // `true`, locked every newly registered seller out of the entire admin
    // taxonomy. Removed so sellers can freely upload to admin categories;
    // ownership of seller-own categories is still enforced by the seller-
    // own controllers themselves.

    // 2. Map fields to match Product model
    const newProductData: any = {
      ...productData,
      seller: sellerId, // Map sellerId to seller
      headerCategoryId: productData.headerCategoryId, // Map headerCategoryId
      // Quick-add / POS may send `category` instead of `categoryId`
      category: productData.categoryId || productData.category,
      subcategory: productData.subcategoryId || productData.subcategory,
      subSubCategory: productData.subSubCategoryId || productData.subSubCategory,
      brand: productData.brandId || productData.brand,
      // Bulk import sends `mainImage`; add form uses `mainImageUrl` — keep whichever is set
      mainImage: productData.mainImageUrl ?? productData.mainImage,
      galleryImages: productData.galleryImageUrls,
    };

    // Drop ref fields that are not valid ObjectIds (names from Excel would otherwise cause cast errors / 400)
    if (newProductData.category && !isValidObjectIdString(newProductData.category)) {
      delete newProductData.category;
    }
    if (newProductData.subcategory && !isValidObjectIdString(newProductData.subcategory)) {
      delete newProductData.subcategory;
    }
    if (newProductData.brand && !isValidObjectIdString(newProductData.brand)) {
      delete newProductData.brand;
    }
    if (newProductData.headerCategoryId && !isValidObjectIdString(newProductData.headerCategoryId)) {
      delete newProductData.headerCategoryId;
    }

    // If still no category (e.g. minimal quick-add / Excel import), use first active category, then any category
    if (!newProductData.category) {
      let defaultCategory = await Category.findOne({ status: "Active" })
        .sort({ createdAt: 1 })
        .select("_id")
        .lean();
      if (!defaultCategory?._id) {
        defaultCategory = await Category.findOne()
          .sort({ createdAt: 1 })
          .select("_id")
          .lean();
      }
      if (defaultCategory?._id) {
        newProductData.category = defaultCategory._id;
      }
    }

    // Normalize variations (quick-add / POS may omit or send non-array)
    const rawVariations = productData.variations;
    const variationsList: any[] = Array.isArray(rawVariations)
      ? rawVariations
      : rawVariations != null && typeof rawVariations === "object"
        ? [rawVariations]
        : [];

    // Map variations: Ensure 'title' from frontend is mapped to 'value' (or name) expected by Schema
    if (variationsList.length > 0) {
      newProductData.variations = variationsList.map((v: any) => {
        const cleaned: any = {
          ...v,
          value: v.value || v.title, // Map title to value
          name: v.name || "Variation", // Default name
          discPrice: v.discPrice || 0,
          status: v.status || "Available",
        };
        // JSON/Excel: NaN becomes null; strings like "199" must be numbers — invalid → 1
        let pv = cleaned.price;
        if (pv === "" || pv === undefined || pv === null) pv = NaN;
        else pv = Number(pv);
        if (!Number.isFinite(pv) || pv < 0) pv = 1;
        cleaned.price = pv;
        // Empty sku breaks MongoDB unique index (multiple docs with ""); omit unless non-empty
        if (cleaned.sku == null || String(cleaned.sku).trim() === "") {
          delete cleaned.sku;
        }
        return cleaned;
      });
    } else {
      delete newProductData.variations;
    }

    // 3. Set Price and Stock from Variations
    // The Product model requires a top-level price and stock
    if (newProductData.variations && newProductData.variations.length > 0) {
      // Use the price of the first variation as the base price (never leave null — fails validation below)
      const v0 = newProductData.variations[0];
      let pTop = v0.price;
      if (pTop === "" || pTop === undefined || pTop === null) pTop = NaN;
      else pTop = Number(pTop);
      if (!Number.isFinite(pTop) || pTop < 0) {
        pTop = 1;
        v0.price = 1;
      }
      newProductData.price = pTop;
      newProductData.discPrice = newProductData.variations[0].discPrice || 0;

      // Calculate total stock (sum of all variations)
      // Note: If any variation has stock 0 (unlimited), how should we handle top level?
      // For now, let's sum them up. If purely unlimited, logic might differ.
      newProductData.stock = newProductData.variations.reduce(
        (acc: number, curr: any) => acc + (parseInt(curr.stock) || 0),
        0
      );
    }

    // 4. Validate Price (Model requirement)
    if (newProductData.price === undefined || newProductData.price === null) {
      return res.status(400).json({
        success: false,
        message: "Product price is required (add at least one variation)",
      });
    }

    // 5. Clean up undefined fields
    if (!newProductData.headerCategoryId)
      delete newProductData.headerCategoryId;
    if (!newProductData.subcategory) delete newProductData.subcategory;
    if (!newProductData.subSubCategory) delete newProductData.subSubCategory;
    if (!newProductData.brand) delete newProductData.brand;
    if (
      newProductData.sku == null ||
      String(newProductData.sku).trim() === ""
    ) {
      delete newProductData.sku;
    }

    // Tax is ObjectId ref — Excel "0" / empty name must not be cast (BSONError).
    if (productData.taxId && isValidObjectIdString(productData.taxId)) {
      newProductData.tax = productData.taxId;
    } else {
      delete newProductData.tax;
    }
    if (newProductData.tax != null && !isValidObjectIdString(newProductData.tax)) {
      delete newProductData.tax;
    }

    // Validate variation prices
    if (newProductData.variations && newProductData.variations.length > 0) {
      for (const variation of newProductData.variations) {
        if (Number(variation.discPrice) > Number(variation.price)) {
          return res.status(400).json({
            success: false,
            message: `Discounted price (${variation.discPrice}) cannot be greater than price (${variation.price}) for variation ${variation.title}`,
          });
        }
      }
    }

    // 6. Set product status.
    //
    // Sellers asked for new products to land as *Inactive* by default —
    // they want to set up pricing/variants/inventory first and then flip
    // the toggle when they're ready to make the product visible. So:
    //   - respect an explicit `publish` from the payload (true/false/"true"/
    //     "false"), the seller form sends this as a real boolean derived
    //     from the "Publish Product?" dropdown
    //   - if nothing was sent (e.g. legacy clients, bulk import scripts),
    //     default to `false` instead of the previous `true`
    //
    // `status` and `requiresApproval` keep the same behaviour as before —
    // there's no approval workflow in this app, so the row goes straight
    // to "Active" status with no approval gate.
    const rawPublish = (newProductData as any).publish;
    if (rawPublish === true || rawPublish === "true") {
      newProductData.publish = true;
    } else if (rawPublish === false || rawPublish === "false") {
      newProductData.publish = false;
    } else {
      newProductData.publish = false;
    }
    newProductData.status = "Active";
    newProductData.requiresApproval = false;

    // Set default values for other required fields if not provided
    if (!newProductData.popular) newProductData.popular = false;
    if (!newProductData.dealOfDay) newProductData.dealOfDay = false;
    if (!newProductData.isReturnable) newProductData.isReturnable = false;
    if (!newProductData.rating) newProductData.rating = 0;
    if (!newProductData.reviewsCount) newProductData.reviewsCount = 0;
    if (!newProductData.discount) newProductData.discount = 0;
    if (!newProductData.tags) newProductData.tags = [];

    // Handle Shop by Store fields
    if (productData.isShopByStoreOnly !== undefined) {
      newProductData.isShopByStoreOnly = productData.isShopByStoreOnly === true || productData.isShopByStoreOnly === "true";
    }
    if (productData.shopId) {
      newProductData.shopId = productData.shopId;
    } else if (newProductData.isShopByStoreOnly) {
      // If shop by store only is true but no shopId provided, set to null
      newProductData.shopId = null;
    }

    // Auto-inherit headerCategoryId from the selected Category when missing.
    // Sellers with `canCreateCategories` OFF aren't allowed to set this directly,
    // but they CAN inherit it from an admin-managed Category they pick — that's
    // the only way their products surface on the right header-category tab.
    if (!newProductData.headerCategoryId && newProductData.category) {
      try {
        const catDoc = await Category.findById(newProductData.category)
          .select("headerCategoryId")
          .lean();
        if (catDoc?.headerCategoryId) {
          newProductData.headerCategoryId = catDoc.headerCategoryId;
        }
      } catch {
        // Non-fatal.
      }
    }

    const product = await Product.create(newProductData);

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  }
);

/**
 * Get seller's products with filters
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const {
    search,
    category,
    status,
    stock,
    redundant,
    page = "1",
    limit = "10",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Build query
  const query: any = { seller: sellerId };

  // Redundant filter (products with same name or barcode for this seller)
  if (redundant) {
    const mongoose = require("mongoose");
    const sellerObjectId = new mongoose.Types.ObjectId(sellerId);
    let duplicateIds: any[] = [];

    // 1. Find duplicate names
    if (redundant === "true" || redundant === "name") {
      const duplicateNames = await Product.aggregate([
        { $match: { seller: sellerObjectId } },
        { $group: { _id: "$productName", count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
      ]);
      duplicateIds = [...duplicateIds, ...duplicateNames.flatMap((d) => d.ids)];
    }

    // 2. Find duplicate barcodes
    if (redundant === "true" || redundant === "barcode") {
      const duplicateBarcodes = await Product.aggregate([
        { $match: { seller: sellerObjectId } },
        { $unwind: "$barcode" },
        { $group: { _id: "$barcode", count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
      ]);
      duplicateIds = [...duplicateIds, ...duplicateBarcodes.flatMap((d) => d.ids)];
    }

    // 3. Find duplicate SKUs
    if (redundant === "true" || redundant === "sku") {
      const duplicateSKUs = await Product.aggregate([
        { $match: { seller: sellerObjectId, sku: { $nin: [null, ""] } } },
        { $group: { _id: "$sku", count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
      ]);
      duplicateIds = [...duplicateIds, ...duplicateSKUs.flatMap((d) => d.ids)];
    }

    query._id = { $in: [...new Set(duplicateIds.map(id => id.toString()))].map(id => new mongoose.Types.ObjectId(id)) };
  }

  // Search filter
  if (search) {
    const searchFilter = [
      { productName: { $regex: search, $options: "i" } },
      { smallDescription: { $regex: search, $options: "i" } },
      { tags: { $in: [new RegExp(search as string, "i")] } },
      { sku: { $regex: search, $options: "i" } },
      { barcode: { $regex: search, $options: "i" } },
      { rackNumber: { $regex: search, $options: "i" } },
      { hsnCode: { $regex: search, $options: "i" } },
      { "variations.sku": { $regex: search, $options: "i" } },
      { "variations.barcode": { $regex: search, $options: "i" } },
    ];

    if (query.$or) {
      // If redundant filter already added $or, we need to wrap it
      query.$and = [
        { $or: query.$or },
        { $or: searchFilter }
      ];
      delete query.$or;
    } else {
      query.$or = searchFilter;
    }
  }

  // Category filter
  if (category) {
    query.category = category;
  }

  // Status filter (publish, popular, dealOfDay)
  if (status) {
    if (status === "published") {
      query.publish = true;
    } else if (status === "unpublished") {
      query.publish = false;
    } else if (status === "popular") {
      query.popular = true;
    } else if (status === "dealOfDay") {
      query.dealOfDay = true;
    }
  }

  // Stock filter
  if (stock === "inStock") {
    query.stock = { $gt: 0 };
  } else if (stock === "outOfStock") {
    query.stock = 0;
  }

  // Pagination
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Sort
  const sort: any = {};
  sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

  const products = await Product.find(query)
    .populate("category", "name")
    .populate("subcategory", "name")
    // .populate("subSubCategory", "name") // Removed as it is now a string
    .populate("brand", "name")
    .populate("tax", "name percentage")
    .sort(sort)
    .skip(skip)
    .limit(limitNum);

  const total = await Product.countDocuments(query);

  return res.status(200).json({
    success: true,
    message: "Products fetched successfully",
    data: products,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * Get product by ID
 */
export const getProductById = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;

    // Prevent reserved route names from being treated as product IDs
    const reservedRoutes = ["shops", "brands"];
    if (reservedRoutes.includes(id)) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = await Product.findOne({ _id: id, seller: sellerId })
      .populate("category", "name")
      .populate("subcategory", "name")
      // .populate("subSubCategory", "name") // Removed as it is now a string
      .populate("headerCategoryId", "name slug")
      .populate("brand", "name")
      .populate("tax", "name percentage");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: product,
    });
  }
);

/**
 * Update product
 */
export const updateProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const updateData = req.body;

    console.log("DEBUG updateProduct: sellerId from token:", sellerId);
    console.log("DEBUG updateProduct: productId:", id);

    // Remove sellerId from update data if present (cannot change owner)
    delete updateData.sellerId;

    // Category Permission Guard removed — see createProduct above for the
    // rationale. Sellers may freely re-assign their products to admin
    // categories on update.

    // Map frontend field names to model field names (same as createProduct)
    if (updateData.headerCategoryId !== undefined) {
      // Allow null/empty to clear header category
      updateData.headerCategoryId = updateData.headerCategoryId || null;
    }
    if (updateData.categoryId) {
      updateData.category = updateData.categoryId;
      delete updateData.categoryId;
    }
    if (updateData.subcategoryId) {
      updateData.subcategory = updateData.subcategoryId;
      delete updateData.subcategoryId;
    }
    if (updateData.subSubCategoryId) {
      updateData.subSubCategory = updateData.subSubCategoryId;
      delete updateData.subSubCategoryId;
    }
    if (updateData.brandId) {
      updateData.brand = updateData.brandId;
      delete updateData.brandId;
    }
    if (updateData.taxId !== undefined && updateData.taxId !== null) {
      if (isValidObjectIdString(updateData.taxId)) {
        updateData.tax = updateData.taxId;
      } else {
        delete updateData.tax;
      }
      delete updateData.taxId;
    }
    if (
      updateData.tax !== undefined &&
      updateData.tax !== null &&
      updateData.tax !== "" &&
      !isValidObjectIdString(updateData.tax)
    ) {
      delete updateData.tax;
    }
    if (updateData.mainImageUrl) {
      updateData.mainImage = updateData.mainImageUrl;
      delete updateData.mainImageUrl;
    }
    if (updateData.galleryImageUrls) {
      updateData.galleryImages = updateData.galleryImageUrls;
      delete updateData.galleryImageUrls;
    }

    // Validate variations if provided
    if (updateData.variations) {
      if (updateData.variations.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Product must have at least one variation",
        });
      }

      // Map variations and validate prices
      updateData.variations = updateData.variations.map((v: any) => ({
        ...v,
        value: v.value || v.title,
        name: v.name || "Variation",
        discPrice: v.discPrice || 0,
        status: v.status || "Available",
      }));

      for (const variation of updateData.variations) {
        if (Number(variation.discPrice) > Number(variation.price)) {
          return res.status(400).json({
            success: false,
            message: `Discounted price cannot be greater than price for variation ${
              variation.title || variation.value
            }`,
          });
        }
      }

      // Sync top-level price and stock from variations (same as createProduct)
      updateData.price = updateData.variations[0].price;
      updateData.discPrice = updateData.variations[0].discPrice || 0;
      updateData.stock = updateData.variations.reduce(
        (acc: number, curr: any) => acc + (parseInt(curr.stock) || 0),
        0
      );
    }

    // Handle Shop by Store fields
    if (updateData.isShopByStoreOnly !== undefined) {
      updateData.isShopByStoreOnly = updateData.isShopByStoreOnly === true || updateData.isShopByStoreOnly === "true";
    }
    if (updateData.shopId !== undefined) {
      // Allow null to clear shopId
      updateData.shopId = updateData.shopId || null;
    } else if (updateData.isShopByStoreOnly === false) {
      // If shop by store only is false, clear shopId
      updateData.shopId = null;
    }

    // Coerce the three boolean status flags to strict booleans before they
    // hit Object.assign below. If any of them isn't explicitly provided as a
    // truthy/falsy value, drop the key so the existing product field is
    // preserved instead of being silently flipped.
    //
    // Why this matters: the Product schema declares
    //     publish: { type: Boolean, default: true }
    // (and the legacy default for `popular`/`dealOfDay` is `false`). If
    // `updateData.publish` arrives as `undefined` (e.g. the field is
    // missing from the payload, or a stale JSON serialisation dropped it
    // because the value was `undefined` client-side), the naive
    // `Object.assign(product, updateData)` further down assigns `undefined`
    // to `product.publish`. On `product.save()` Mongoose then re-applies
    // the schema default `true`, which flips an *Inactive* product to
    // *Active* without the seller ever touching that toggle — exactly the
    // bug sellers reported ("I edited the price of an Inactive product,
    // hit Save, and it became Active").
    //
    // Same shape used by `isShopByStoreOnly` above; keeping a single
    // consistent style makes the intent obvious.
    (["publish", "popular", "dealOfDay"] as const).forEach((flag) => {
      const raw = (updateData as any)[flag];
      if (raw === true || raw === "true") {
        (updateData as any)[flag] = true;
      } else if (raw === false || raw === "false") {
        (updateData as any)[flag] = false;
      } else {
        // Anything else (undefined, null, missing) -> don't touch the
        // existing value on the product document.
        delete (updateData as any)[flag];
      }
    });

    // Use findOne and then save to trigger pre-save hooks
    const product = await Product.findOne({ _id: id, seller: sellerId });

    if (!product) {
      // Check if product exists at all
      const existingProduct = await Product.findById(id).select("seller");
      if (existingProduct) {
        console.log(
          "DEBUG updateProduct: product exists but owned by:",
          existingProduct.seller
        );
      }
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Auto-inherit headerCategoryId from the (possibly newly-set) category if
    // the caller didn't touch it explicitly. Keeps the product on the right
    // header-category tab when sellers move it between categories.
    if (
      updateData.headerCategoryId === undefined &&
      updateData.category &&
      String(updateData.category) !== String(product.category)
    ) {
      try {
        const catDoc = await Category.findById(updateData.category)
          .select("headerCategoryId")
          .lean();
        if (catDoc?.headerCategoryId) {
          updateData.headerCategoryId = catDoc.headerCategoryId;
        }
      } catch {
        // Non-fatal.
      }
    }

    // Apply updates
    Object.assign(product, updateData);

    // If variations were updated, mark as modified
    if (updateData.variations) {
      product.markModified("variations");
    }

    await product.save();

    // Re-populate for response
    const populatedProduct = await Product.findById(product._id)
      .populate("category", "name")
      .populate("subcategory", "name")
      // .populate("subSubCategory", "name") // Removed as it is now a string
      .populate("headerCategoryId", "name slug")
      .populate("brand", "name")
      .populate("tax", "name percentage");

    console.log("DEBUG updateProduct: product updated successfully");

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: populatedProduct,
    });
  }
);

/**
 * Delete product
 */
export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;

    console.log("DEBUG deleteProduct: sellerId from token:", sellerId);
    console.log("DEBUG deleteProduct: productId:", id);

    const product = await Product.findOneAndDelete({
      _id: id,
      seller: sellerId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  }
);

/**
 * Update stock for a product variation
 */
export const updateStock = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const { id, variationId } = req.params;
  const { stock, status } = req.body;

  const product = await Product.findOne({ _id: id, seller: sellerId });

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  const variation: any = product.variations?.find(
    (v: any) => v._id?.toString() === variationId
  );
  if (!variation) {
    return res.status(404).json({
      success: false,
      message: "Variation not found",
    });
  }

  if (stock !== undefined) {
    variation.stock = stock;
    // Automatically update status based on stock
    if (stock === 0) {
      variation.status = "Sold out";
    } else if (stock > 0 && variation.status === "Sold out") {
      variation.status = "Available";
    }
  }
  if (status) {
    variation.status = status;
  }

  // Mark variations as modified since we updated a sub-document field
  product.markModified("variations");
  await product.save();

  return res.status(200).json({
    success: true,
    message: "Stock updated successfully",
    data: product,
  });
});

/**
 * Update product status (publish, popular, dealOfDay)
 */
export const updateProductStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const { publish, popular, dealOfDay } = req.body;

    const updateData: any = {};
    if (publish !== undefined) updateData.publish = publish;
    if (popular !== undefined) updateData.popular = popular;
    if (dealOfDay !== undefined) updateData.dealOfDay = dealOfDay;

    const product = await Product.findOneAndUpdate(
      { _id: id, seller: sellerId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product status updated successfully",
      data: product,
    });
  }
);

/**
 * Bulk update stock for multiple products/variations
 */
export const bulkUpdateStock = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { updates } = req.body; // Array of { productId, variationId, stock }

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: "Updates must be an array",
      });
    }

    const results = [];
    for (const update of updates) {
      const { productId, variationId, stock } = update;

      const product = await Product.findOne({
        _id: productId,
        seller: sellerId,
      });
      if (product) {
        const variation: any = product.variations?.find(
          (v: any) => v._id?.toString() === variationId
        );
        if (variation) {
          variation.stock = stock;
          if (stock === 0) variation.status = "Sold out";
          else if (stock > 0 && variation.status === "Sold out")
            variation.status = "In stock";

          await product.save();
          results.push({ productId, variationId, success: true });
        } else {
          results.push({
            productId,
            variationId,
            success: false,
            message: "Variation not found",
          });
        }
      } else {
        results.push({
          productId,
          variationId,
          success: false,
          message: "Product not found",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Bulk stock update processed",
      data: results,
    });
  }
);

/**
 * Get all active shops (for seller to select when creating shop-by-store-only products)
 */
export const getShops = asyncHandler(async (_req: Request, res: Response) => {
  const shops = await Shop.find({ isActive: true })
    .select("_id name storeId image")
    .sort({ order: 1, name: 1 })
    .lean();

  return res.status(200).json({
    success: true,
    message: "Shops fetched successfully",
    data: shops || [],
  });
});
