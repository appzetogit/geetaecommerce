import mongoose from "mongoose";
import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Brand from "../../../models/Brand";
import Product from "../../../models/Product";
import Inventory from "../../../models/Inventory";
import Seller from "../../../models/Seller";
import HeaderCategory from "../../../models/HeaderCategory";
import { cache } from "../../../utils/cache";
import {
  ProductWriteService,
  ProductWriteError,
} from "../../product/productWriteService";
import { adminProductPolicy } from "../../product/productPolicies";
import { toDetail, toListItem, toListItems } from "../../product/productReadMapper";

// ==================== Category Controllers ====================

/**
 * Create a new category
 */
export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      name,
      image,
      order,
      isBestseller,
      hasWarning,
      groupCategory,
      parentId,
      headerCategoryId,
      status = "Active",
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    let finalHeaderCategoryId = headerCategoryId;

    // Validate parent if provided
    if (parentId) {
      // Cannot set parent to self
      if (parentId === req.body._id) {
        return res.status(400).json({
          success: false,
          message: "Cannot set category as its own parent",
        });
      }

      const parent = await Category.findById(parentId);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
      }

      if (parent.status !== "Active") {
        return res.status(400).json({
          success: false,
          message: "Parent category must be active",
        });
      }

      // Inherit headerCategoryId from parent if not explicitly provided
      if (!finalHeaderCategoryId && parent.headerCategoryId) {
        finalHeaderCategoryId = parent.headerCategoryId.toString();
      }

      // If parent doesn't have headerCategoryId, subcategory cannot be created
      if (!finalHeaderCategoryId) {
        return res.status(400).json({
          success: false,
          message:
            "Parent category does not have a header category assigned. Please assign a header category to the parent category first.",
        });
      }
    }

    // Validate headerCategoryId (required for root categories)
    if (!finalHeaderCategoryId && !parentId) {
      return res.status(400).json({
        success: false,
        message: "Header category is required for root categories",
      });
    }

    // Validate headerCategory exists and is Published
    if (finalHeaderCategoryId) {
      const headerCategory = await HeaderCategory.findById(
        finalHeaderCategoryId
      );
      if (!headerCategory) {
        return res.status(400).json({
          success: false,
          message: "Header category not found",
        });
      }

      if (headerCategory.status !== "Published") {
        return res.status(400).json({
          success: false,
          message: "Header category must be Published",
        });
      }
    }

    // Auto-calculate order if not provided
    let finalOrder = order;
    if (finalOrder === undefined || finalOrder === null) {
      const lastCategory = await Category.findOne({
        parentId: parentId || null,
      })
        .sort({ order: -1 })
        .limit(1);
      finalOrder = lastCategory ? (lastCategory.order || 0) + 1 : 0;
    }

    const category = await Category.create({
      name,
      image,
      order: finalOrder,
      isBestseller: isBestseller || false,
      hasWarning: hasWarning || false,
      groupCategory,
      parentId: parentId || null,
      headerCategoryId: finalHeaderCategoryId || null,
      status,
    });

    // Invalidate category caches
    cache.delete("customer-categories-list");
    cache.delete("customer-categories-tree");
    cache.invalidatePattern(/^customer-category-/);

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  }
);

/**
 * Get all categories
 */
export const getCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      search,
      sortBy = "order",
      sortOrder = "asc",
      parentId,
      includeChildren = "false",
      status,
      headerCategoryId,
    } = req.query;

    const query: any = {};
    if (search) {
      query.name = { $regex: search as string, $options: "i" };
    }
    if (parentId !== undefined) {
      if (parentId === "null" || parentId === null || parentId === "") {
        query.parentId = null;
      } else {
        query.parentId = parentId;
      }
    }
    if (status) {
      query.status = status;
    }
    if (headerCategoryId) {
      query.headerCategoryId = headerCategoryId;
    }

    const sort: any = {};
    sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

    const categories = await Category.find(query)
      .populate("parentId", "name")
      .populate("headerCategoryId", "name status")
      .sort(sort);

    // Count child categories for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const childrenCount = await Category.countDocuments({
          parentId: category._id,
        });
        // Also count old SubCategory model for backward compatibility
        const subcategoryCount = await SubCategory.countDocuments({
          category: category._id,
        });
        return {
          ...category.toObject(),
          childrenCount,
          totalSubcategories: childrenCount + subcategoryCount,
        };
      })
    );

    // If includeChildren is true, build hierarchical structure
    if (includeChildren === "true") {
      const buildTree = (parentId: any = null): any[] => {
        return categoriesWithCounts
          .filter((cat) => {
            const catParentId = cat.parentId
              ? cat.parentId._id || cat.parentId
              : null;
            const parentIdStr = parentId ? parentId.toString() : null;
            const catParentIdStr = catParentId ? catParentId.toString() : null;
            return catParentIdStr === parentIdStr;
          })
          .map((cat) => ({
            ...cat,
            children: buildTree(cat._id),
          }));
      };

      const tree = buildTree();
      return res.status(200).json({
        success: true,
        message: "Categories fetched successfully",
        data: tree,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: categoriesWithCounts,
    });
  }
);

/**
 * Update category
 */
export const updateCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Validate parent change if parentId is being updated
    if (updateData.parentId !== undefined) {
      const validation = await Category.validateParentChange(
        id,
        updateData.parentId
      );
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        });
      }

      // If parent is being set, inherit headerCategoryId from parent if not explicitly provided
      if (updateData.parentId && !updateData.headerCategoryId) {
        const parent = await Category.findById(updateData.parentId);
        if (parent && parent.headerCategoryId) {
          updateData.headerCategoryId = parent.headerCategoryId;
        }
      }
    }

    // Validate headerCategoryId if being updated
    if (updateData.headerCategoryId !== undefined) {
      // If category has children, they should inherit the same header category
      // But we allow the change - children will keep their current headerCategoryId
      // unless explicitly updated

      // Validate headerCategory exists and is Published
      if (updateData.headerCategoryId) {
        const headerCategory = await HeaderCategory.findById(
          updateData.headerCategoryId
        );
        if (!headerCategory) {
          return res.status(400).json({
            success: false,
            message: "Header category not found",
          });
        }

        if (headerCategory.status !== "Published") {
          return res.status(400).json({
            success: false,
            message: "Header category must be Published",
          });
        }
      } else {
        // If headerCategoryId is being set to null/empty, check if category has children
        const childrenCount = await Category.countDocuments({ parentId: id });
        if (childrenCount > 0) {
          return res.status(400).json({
            success: false,
            message:
              "Cannot remove header category from a category that has subcategories",
          });
        }
      }
    }

    // Track if status is changing
    const statusChanged = updateData.status && updateData.status !== category.status;

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("parentId", "name")
      .populate("headerCategoryId", "name status");

    // If status changed, invalidate caches (product status sync removed)
    if (statusChanged && updatedCategory) {
      // await syncProductsWithCategoryStatus(id, updatedCategory.status);
    }

    // Invalidate category caches
    cache.delete("customer-categories-list");
    cache.delete("customer-categories-tree");
    cache.invalidatePattern(/^customer-category-/);

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  }
);

/**
 * Delete category
 */
export const deleteCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Check if category has child categories (using parentId)
    const childrenCount = await Category.countDocuments({ parentId: id });
    if (childrenCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category with subcategories. Please delete or move subcategories first.",
      });
    }

    // Check if category has old-style subcategories (backward compatibility)
    const subcategoryCount = await SubCategory.countDocuments({ category: id });
    if (subcategoryCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category with subcategories. Please delete or move subcategories first.",
      });
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with products",
      });
    }

    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Invalidate category caches
    cache.delete("customer-categories-list");
    cache.delete("customer-categories-tree");
    cache.invalidatePattern(/^customer-category-/);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  }
);

/**
 * Update category order
 */
export const updateCategoryOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { categories } = req.body; // Array of { id, order }

    if (!Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        message: "Categories array is required",
      });
    }

    const updatePromises = categories.map(
      ({ id, order }: { id: string; order: number }) =>
        Category.findByIdAndUpdate(
          id,
          { order, updatedAt: new Date() },
          { new: true }
        )
    );

    await Promise.all(updatePromises);

    // Invalidate category caches
    cache.delete("customer-categories-list");
    cache.delete("customer-categories-tree");
    cache.invalidatePattern(/^customer-category-/);

    return res.status(200).json({
      success: true,
      message: "Category order updated successfully",
    });
  }
);

/**
 * Toggle category status
 */
export const toggleCategoryStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, cascadeToChildren } = req.body;

    if (!["Active", "Inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Active or Inactive",
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Update category status
    category.status = status;
    await category.save();

    // Invalidate product caches (product status sync removed)
    // await syncProductsWithCategoryStatus(id, status);

    // Optionally cascade to children
    if (cascadeToChildren === true) {
      await Category.updateMany(
        { parentId: id },
        { status, updatedAt: new Date() }
      );

      // If cascading, we also need to sync products for each child
      // Actually, our helper already handles all descendants!
    }

    // Invalidate category caches
    cache.delete("customer-categories-list");
    cache.delete("customer-categories-tree");
    cache.invalidatePattern(/^customer-category-/);

    return res.status(200).json({
      success: true,
      message: `Category status updated to ${status}`,
      data: category,
    });
  }
);

/**
 * Bulk delete categories
 */
export const bulkDeleteCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Category IDs array is required",
      });
    }

    const results = {
      deleted: [] as string[],
      failed: [] as Array<{ id: string; reason: string }>,
    };

    for (const categoryId of categoryIds) {
      try {
        // Check for child categories
        const childrenCount = await Category.countDocuments({
          parentId: categoryId,
        });
        if (childrenCount > 0) {
          results.failed.push({
            id: categoryId,
            reason: "Category has child categories",
          });
          continue;
        }

        // Check for old-style subcategories
        const subcategoryCount = await SubCategory.countDocuments({
          category: categoryId,
        });
        if (subcategoryCount > 0) {
          results.failed.push({
            id: categoryId,
            reason: "Category has subcategories",
          });
          continue;
        }

        // Check for products
        const productCount = await Product.countDocuments({
          category: categoryId,
        });
        if (productCount > 0) {
          results.failed.push({
            id: categoryId,
            reason: "Category has associated products",
          });
          continue;
        }

        // Delete category
        const category = await Category.findByIdAndDelete(categoryId);
        if (category) {
          results.deleted.push(categoryId);
        } else {
          results.failed.push({
            id: categoryId,
            reason: "Category not found",
          });
        }
      } catch (error: any) {
        results.failed.push({
          id: categoryId,
          reason: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Bulk delete completed: ${results.deleted.length} deleted, ${results.failed.length} failed`,
      data: results,
    });
  }
);

// ==================== SubCategory Controllers ====================

/**
 * Create a new subcategory
 */
export const createSubCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, category, image, order } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: "Subcategory name and category are required",
      });
    }

    const subcategory = await SubCategory.create({
      name,
      category,
      image,
      order: order || 0,
    });

    // Update category subcategory count
    await Category.findByIdAndUpdate(category, {
      $inc: { totalSubcategories: 1 },
    });

    return res.status(201).json({
      success: true,
      message: "Subcategory created successfully",
      data: subcategory,
    });
  }
);

/**
 * Get all subcategories
 */
export const getSubCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const { category: categoryId, search, sortBy = "order", sortOrder = "asc" } = req.query;

    // 1. Fetch from legacy SubCategory model
    const subQuery: any = {};
    if (categoryId) {
      subQuery.category = categoryId;
    }
    if (search) {
      subQuery.name = { $regex: search as string, $options: "i" };
    }

    const sort: any = {};
    sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

    const legacySubcategories = await SubCategory.find(subQuery)
      .populate("category", "name")
      .sort(sort);

    // 2. Fetch hierarchical subcategories from Category model (where parentId matches categoryId)
    const catQuery: any = {};
    if (categoryId) {
      catQuery.parentId = categoryId;
    } else {
      catQuery.parentId = { $ne: null }; // Only get children if no category specified
    }

    if (search) {
      catQuery.name = { $regex: search as string, $options: "i" };
    }

    const hierarchicalCategories = await Category.find(catQuery)
      .populate("parentId", "name")
      .sort(sort);

    // 3. Map hierarchical categories to subcategory format
    const mappedHierarchical = hierarchicalCategories.map((cat) => {
      const obj = cat.toObject();
      return {
        ...obj,
        category: obj.parentId, // Map parentId to 'category' for frontend compatibility
      };
    });

    // 4. Combine both
    const allSubcategories = [...legacySubcategories, ...mappedHierarchical];

    // 5. Get product counts for each subcategory
    const resultsWithCounts = await Promise.all(
      allSubcategories.map(async (subcategory: any) => {
        const productCount = await Product.countDocuments({
          subcategory: subcategory._id,
        });

        return {
          ...subcategory,
          totalProduct: productCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Subcategories fetched successfully",
      data: resultsWithCounts,
    });
  }
);

/**
 * Update subcategory
 */
export const updateSubCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const subcategory = await SubCategory.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("category", "name");

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subcategory updated successfully",
      data: subcategory,
    });
  }
);

/**
 * Delete subcategory
 */
export const deleteSubCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Check if subcategory has products
    const productCount = await Product.countDocuments({ subcategory: id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete subcategory with products",
      });
    }

    const subcategory = await SubCategory.findByIdAndDelete(id);

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    // Update category subcategory count
    await Category.findByIdAndUpdate(subcategory.category, {
      $inc: { totalSubcategories: -1 },
    });

    return res.status(200).json({
      success: true,
      message: "Subcategory deleted successfully",
    });
  }
);

// ==================== Brand Controllers ====================

/**
 * Create a new brand
 */
export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const { name, image } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Brand name is required",
    });
  }

  const brand = await Brand.create({ name, image });

  return res.status(201).json({
    success: true,
    message: "Brand created successfully",
    data: brand,
  });
});

/**
 * Get all brands
 */
export const getBrands = asyncHandler(async (req: Request, res: Response) => {
  const { search } = req.query;

  const query: any = {};
  if (search) {
    query.name = { $regex: search as string, $options: "i" };
  }

  const brands = await Brand.find(query).sort({ name: 1 });

  return res.status(200).json({
    success: true,
    message: "Brands fetched successfully",
    data: brands,
  });
});

/**
 * Update brand
 */
export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const brand = await Brand.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!brand) {
    return res.status(404).json({
      success: false,
      message: "Brand not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Brand updated successfully",
    data: brand,
  });
});

/**
 * Delete brand
 */
export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if brand has products
  const productCount = await Product.countDocuments({ brand: id });
  if (productCount > 0) {
    return res.status(400).json({
      success: false,
      message: "Cannot delete brand with products",
    });
  }

  const brand = await Brand.findByIdAndDelete(id);

  if (!brand) {
    return res.status(404).json({
      success: false,
      message: "Brand not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Brand deleted successfully",
  });
});

// ==================== Product Controllers ====================

function isValidObjectIdString(id: unknown): boolean {
  if (id == null) return false;
  const s = String(id).trim();
  return /^[a-fA-F0-9]{24}$/.test(s);
}

function stripInvalidProductObjectIds(body: Record<string, unknown>): void {
  const keys = [
    "category",
    "subcategory",
    "brand",
    "tax",
    "headerCategoryId",
    "seller",
    "shopId",
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
    try {
      stripInvalidProductObjectIds(req.body);
      const product = await ProductWriteService.createProduct(
        req.body,
        adminProductPolicy
      );
      return res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product,
      });
    } catch (error: any) {
      if (error instanceof ProductWriteError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map(
          (val: any) => val.message
        );
        return res.status(400).json({
          success: false,
          message: messages.join(", "),
        });
      }
      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: `Invalid value for ${error.path}: ${error.value}`,
        });
      }
      return res.status(500).json({
        success: false,
        message: "Error creating product: " + error.message,
      });
    }
  }
);

/**
 * Get all products
 * Returns all products regardless of status (no approval workflow)
 * Use status query param to filter by specific status if needed
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    search,
    category,
    subcategory,
    brand,
    seller,
    status,
    publish,
    redundant,
  } = req.query;

  const query: any = {};

  // Redundant filter (products with same name or barcode within same seller)
  if (redundant) {
    let duplicateIds: any[] = [];

    // 1. Find duplicate names per seller
    if (redundant === "true" || redundant === "name") {
      const duplicateNames = await Product.aggregate([
        { $group: { _id: { seller: "$seller", name: "$productName" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
      ]);
      duplicateIds = [...duplicateIds, ...duplicateNames.flatMap((d) => d.ids)];
    }

    // 2. Find duplicate barcodes per seller
    if (redundant === "true" || redundant === "barcode") {
      const duplicateBarcodes = await Product.aggregate([
        { $unwind: "$barcode" },
        { $group: { _id: { seller: "$seller", barcode: "$barcode" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
      ]);
      duplicateIds = [...duplicateIds, ...duplicateBarcodes.flatMap((d) => d.ids)];
    }

    // 3. Find duplicate SKUs per seller
    if (redundant === "true" || redundant === "sku") {
      const duplicateSKUs = await Product.aggregate([
        { $match: { sku: { $nin: [null, ""] } } },
        { $group: { _id: { seller: "$seller", sku: "$sku" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
      ]);
      duplicateIds = [...duplicateIds, ...duplicateSKUs.flatMap((d) => d.ids)];
    }

    query._id = { $in: [...new Set(duplicateIds)] };
  }

  if (search) {
    const searchFilter = [
      { productName: { $regex: search as string, $options: "i" } },
      { sku: { $regex: search as string, $options: "i" } },
      { barcode: { $regex: search as string, $options: "i" } },
      { "variations.barcode": { $regex: search as string, $options: "i" } },
      { rackNumber: { $regex: search as string, $options: "i" } },
      { hsnCode: { $regex: search as string, $options: "i" } },
    ];

    if (query._id) {
       query.$and = [
         { _id: query._id },
         { $or: searchFilter }
       ];
       delete query._id;
    } else {
      query.$or = searchFilter;
    }
  }
  if (category) query.category = category;
  if (subcategory) query.subcategory = subcategory;
  if (brand) query.brand = brand;
  if (seller) query.seller = seller;

  // Only filter by status if explicitly provided
  // All products show by default (no approval workflow)
  if (status) {
    query.status = status;
  }

  // Unpublished products (admin UI badge "Inactive") are hidden by default
  // because the seller is signalling they don't want the product live. The
  // admin can still see them by explicitly filtering for `publish=false`
  // (the "Unpublished" option in the Status dropdown on the stock screen).
  if (publish !== undefined) {
    query.publish = publish === "true";
  } else {
    query.publish = true;
  }

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const [productsRaw, totalEntries] = await Promise.all([
    Product.find(query)
      .populate("category", "name")
      .populate("brand", "name")
      .populate("seller", "sellerName storeName")
      .populate("tax", "name percentage")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string)),
    Product.countDocuments(query),
  ]);

  // Manually populate subcategory because it can be from either Category collection (hierarchical) or SubCategory collection (legacy)
  const subIds = [...new Set(productsRaw.map(p => p.subcategory).filter(id => id && typeof id === 'string' || id instanceof mongoose.Types.ObjectId))];

  const [subsFromLegacy, subsFromCategory] = await Promise.all([
    SubCategory.find({ _id: { $in: subIds } }).select("name").lean(),
    Category.find({ _id: { $in: subIds } }).select("name").lean()
  ]);

  const subMap = new Map();
  subsFromLegacy.forEach(s => subMap.set(String(s._id), s));
  subsFromCategory.forEach(c => subMap.set(String(c._id), c));

  const products = productsRaw.map(p => {
    const obj = p.toObject();
    if (obj.subcategory) {
      const subIdStr = String(obj.subcategory);
      if (subMap.has(subIdStr)) {
        obj.subcategory = subMap.get(subIdStr);
      }
    }
    return toListItem(obj);
  });

  return res.status(200).json({
    success: true,
    message: "Products fetched successfully",
    data: products,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total: totalEntries,
      pages: Math.ceil(totalEntries / parseInt(limit as string)),
    },
  });
});

/**
 * Get product by ID
 */
export const getProductById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const rawProduct = await Product.findById(id)
      .populate("category", "name")
      .populate("brand", "name")
      .populate("seller", "sellerName storeName")
      .populate("approvedBy", "firstName lastName");

    if (!rawProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const subId = rawProduct.subcategory;
    let populatedSub = null;
    if (subId) {
      populatedSub = await SubCategory.findById(subId).select("name").lean();
      if (!populatedSub) {
        populatedSub = await Category.findById(subId).select("name").lean();
      }
    }

    const product: any = rawProduct.toObject();
    if (populatedSub) {
      product.subcategory = populatedSub;
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: toDetail(product),
    });
  }
);

/**
 * Update product
 */
export const updateProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      stripInvalidProductObjectIds(req.body);
      const product = await ProductWriteService.updateProduct(
        id,
        req.body,
        adminProductPolicy
      );
      return res.status(200).json({
        success: true,
        message: "Product updated successfully",
        data: product,
      });
    } catch (error: any) {
      if (error instanceof ProductWriteError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        message: error.message || "Error updating product",
      });
    }
  }
);

/**
 * Delete product
 */
export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete inventory record
    await Inventory.findOneAndDelete({ product: id });

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  }
);

/**
 * Approve/reject product request
 */
export const approveProductRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["Active", "Rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Active or Rejected",
      });
    }

    const updateData: any = {
      status,
      approvedBy: req.user?.userId,
      approvedAt: new Date(),
    };

    if (status === "Rejected" && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("category", "name")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .populate("seller", "sellerName storeName");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Product ${
        status === "Active" ? "approved" : "rejected"
      } successfully`,
      data: product,
    });
  }
);

/**
 * Bulk import products
 */
export const bulkImportProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Products array is required",
      });
    }

    const results = await ProductWriteService.bulkImportProducts(
      products,
      adminProductPolicy
    );

    return res.status(200).json({
      success: true,
      message: `Bulk import completed: ${results.success} succeeded, ${results.failed} failed`,
      data: results,
    });
  }
);

/**
 * Bulk update products
 */
export const bulkUpdateProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { productIds, updateData } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product IDs array is required",
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Update data is required",
      });
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: updateData }
    );

    // Update inventory if stock is being updated
    if (updateData.stock !== undefined) {
      await Inventory.updateMany(
        { product: { $in: productIds } },
        {
          currentStock: updateData.stock,
          availableStock: updateData.stock,
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} products updated successfully`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  }
);

/**
 * Backfill `headerCategoryId` on existing products from their Category.
 *
 * Historically, products were created/imported without explicitly setting
 * `headerCategoryId`. The header-category tab on the storefront then relied on
 * a Category-tree walk to surface those products, which can silently miss
 * items (e.g. inactive intermediate categories, partially-tagged trees).
 *
 * This endpoint runs a one-shot reconciliation: for every product missing a
 * `headerCategoryId`, if its `category` document has one, copy it onto the
 * product so it appears on the correct header tab.
 *
 * Optional body param: { dryRun: boolean } — when true, only reports counts.
 */
export const backfillProductHeaderCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const dryRun = req.body?.dryRun === true;

    // Find candidate products: missing headerCategoryId and have a category set.
    const products = await Product.find({
      category: { $exists: true, $ne: null },
      $or: [
        { headerCategoryId: { $exists: false } },
        { headerCategoryId: null },
      ],
    })
      .select("_id category headerCategoryId")
      .lean();

    if (products.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No products need backfill",
        data: { scanned: 0, updated: 0 },
      });
    }

    // Resolve headerCategoryId for each unique Category referenced by candidates.
    const uniqueCategoryIds = Array.from(
      new Set(products.map((p: any) => String(p.category)))
    );

    const categories = await Category.find({
      _id: { $in: uniqueCategoryIds },
    })
      .select("_id headerCategoryId")
      .lean();

    const categoryHeaderMap = new Map<string, string>();
    for (const cat of categories) {
      if ((cat as any).headerCategoryId) {
        categoryHeaderMap.set(
          String(cat._id),
          String((cat as any).headerCategoryId)
        );
      }
    }

    // Group products by target headerCategoryId to enable bulk updateMany.
    const byHeader: Record<string, mongoose.Types.ObjectId[]> = {};
    let candidateCount = 0;
    for (const p of products as any[]) {
      const headerId = categoryHeaderMap.get(String(p.category));
      if (!headerId) continue;
      if (!byHeader[headerId]) byHeader[headerId] = [];
      byHeader[headerId].push(p._id);
      candidateCount += 1;
    }

    if (dryRun) {
      return res.status(200).json({
        success: true,
        message: `Dry-run complete: ${candidateCount} products would be updated across ${Object.keys(byHeader).length} header categories`,
        data: {
          scanned: products.length,
          willUpdate: candidateCount,
          byHeader: Object.fromEntries(
            Object.entries(byHeader).map(([k, v]) => [k, v.length])
          ),
        },
      });
    }

    let modifiedTotal = 0;
    for (const [headerIdStr, productIds] of Object.entries(byHeader)) {
      const headerId = new mongoose.Types.ObjectId(headerIdStr);
      const result = await Product.updateMany(
        { _id: { $in: productIds } },
        { $set: { headerCategoryId: headerId } }
      );
      modifiedTotal += result.modifiedCount ?? 0;
    }

    return res.status(200).json({
      success: true,
      message: `Backfilled headerCategoryId on ${modifiedTotal} products`,
      data: {
        scanned: products.length,
        updated: modifiedTotal,
      },
    });
  }
);

/**
 * Update product display order (for featured lists etc)
 */
export const updateProductOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { products } = req.body; // Array of { id, order }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Products array is required",
      });
    }

    const updates = products.map(({ id, order }) =>
      Product.findByIdAndUpdate(id, { order })
    );

    await Promise.all(updates);

    return res.status(200).json({
      success: true,
      message: "Product order updated successfully",
    });
  }
);

/**
 * Get all products for POS billing (Lightweight with stock)
 */
export const getPOSProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { search } = req.query;
    const query: any = { status: "Active" };

    if (search) {
        const searchRegex = new RegExp(search as string, "i");
        query.$or = [
            { productName: searchRegex },
            { sku: searchRegex },
            { barcode: searchRegex },
            { "variations.sku": searchRegex },
            { "variations.barcode": searchRegex },
            { itemCode: searchRegex }
        ];
    }

    const products = await Product.find(query)
      .select("productName mainImage price compareAtPrice wholesalePrice purchasePrice discPrice stock sku variations category barcode itemCode hsnCode gst")
      .populate("category", "name")
      .sort({ productName: 1 });

    return res.status(200).json({
      success: true,
      message: "POS products fetched successfully",
      data: products
    });
  }
);

/**
 * Generate a unique barcode based on product data (productName and variationValue)
 */
export const generateUniqueBarcode = asyncHandler(
  async (req: Request, res: Response) => {
    const { productName = "", variationValue = "", excludeBarcodes } = req.query;

    const excludeList: string[] = [];
    if (Array.isArray(excludeBarcodes)) {
      excludeList.push(...excludeBarcodes.map(String).map(s => s.trim()).filter(Boolean));
    } else if (typeof excludeBarcodes === "string") {
      excludeList.push(...excludeBarcodes.split(",").map(s => s.trim()).filter(Boolean));
    }

    const combinedStr = `${productName}_${variationValue}`;
    let hash = 0;
    for (let i = 0; i < combinedStr.length; i++) {
      hash = (hash * 31 + combinedStr.charCodeAt(i)) % 1000000;
    }
    const prefixNum = String(hash).padStart(6, "0");

    let suffix = 1000;
    let uniqueBarcode = "";
    let isUnique = false;

    while (!isUnique) {
      suffix++;
      uniqueBarcode = `${prefixNum}${suffix}`;

      if (excludeList.includes(uniqueBarcode)) {
        continue;
      }

      const existing = await Product.findOne({
        $or: [
          { barcode: uniqueBarcode },
          { "variations.barcode": uniqueBarcode }
        ]
      });
      if (!existing) {
        isUnique = true;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Unique barcode generated successfully",
      barcode: uniqueBarcode
    });
  }
);

/**
 * Check if a barcode is globally unique (excluding optional productId)
 */
export const checkBarcodeUnique = asyncHandler(
  async (req: Request, res: Response) => {
    const { barcode = "", productId = "" } = req.query;
    const trimmed = String(barcode).trim();
    if (!trimmed) {
      return res.status(200).json({ success: true, isUnique: true });
    }

    const query: Record<string, any> = {
      $or: [
        { barcode: trimmed },
        { "variations.barcode": trimmed }
      ]
    };

    if (productId && mongoose.Types.ObjectId.isValid(productId as string)) {
      query._id = { $ne: productId };
    }

    const existing = await Product.findOne(query);
    if (existing) {
      return res.status(200).json({
        success: true,
        isUnique: false,
        message: `Barcode is already in use by product "${existing.productName}"`
      });
    }

    return res.status(200).json({
      success: true,
      isUnique: true
    });
  }
);


