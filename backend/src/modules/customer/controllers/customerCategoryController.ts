import { Request, Response } from "express";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Product from "../../../models/Product";
import mongoose from "mongoose";
import { cache } from "../../../utils/cache";
import Seller from "../../../models/Seller";

// Get all categories (public) - with caching
export const getCategories = async (_req: Request, res: Response) => {
  try {
    const cacheKey = "customer-categories-list";

    // Try cache first
    let categories = cache.get(cacheKey);

    if (!categories) {
      categories = await Category.find({
        status: "Active", // Only return active categories
      })
        .sort({ order: 1 })
        .select("name image icon description color slug _id")
        .lean(); // Use lean() for better performance

      // Cache for 10 minutes
      cache.set(cacheKey, categories, 10 * 60 * 1000);
    }

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    });
  }
};

// Get all categories with their subcategories (for menu/sidebar) - with caching
export const getCategoriesWithSubs = async (_req: Request, res: Response) => {
  try {
    const cacheKey = "customer-categories-tree";

    // Try cache first
    let categoriesWithSubs = cache.get(cacheKey);

    if (categoriesWithSubs) {
      return res.status(200).json({
        success: true,
        data: categoriesWithSubs,
      });
    }

    const categories = await Category.find({ status: "Active" })
      .sort({ order: 1 })
      .lean();

    // Build product count maps to filter categories/subcategories that actually have products
    // Only count products from visible sellers (gated solely by `isEnabled`).
    const visibleSellers = await Seller.find({ isEnabled: true }).select("_id");
    const visibleSellerIds = visibleSellers.map(s => s._id);

    const activeProductMatch: any = { 
      status: "Active", 
      publish: true,
      seller: { $in: visibleSellerIds }
    };

    const [categoryCounts, subcategoryCounts] = await Promise.all([
      Product.aggregate([
        { $match: activeProductMatch },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      Product.aggregate([
        { $match: activeProductMatch },
        { $group: { _id: "$subcategory", count: { $sum: 1 } } },
      ]),
    ]);

    const categoryCountMap = new Map<string, number>();
    categoryCounts.forEach((item) => {
      if (item._id) {
        categoryCountMap.set(item._id.toString(), item.count);
      }
    });

    const subcategoryCountMap = new Map<string, number>();
    subcategoryCounts.forEach((item) => {
      if (item._id) {
        subcategoryCountMap.set(item._id.toString(), item.count);
      }
    });

    categoriesWithSubs = await Promise.all(
      categories.map(async (category) => {
        const subcategories = await SubCategory.find({
          category: category._id,
        })
          .sort({ order: 1 })
          .select("name image order");

        // Keep only subcategories that have at least one product
        const filteredSubs = subcategories.filter((sub) =>
          subcategoryCountMap.has(sub._id.toString())
        );

        const directCategoryCount =
          categoryCountMap.get(category._id.toString()) || 0;
        const subsProductCount = filteredSubs.reduce(
          (total, sub) =>
            total + (subcategoryCountMap.get(sub._id.toString()) || 0),
          0
        );
        const totalProducts = directCategoryCount + subsProductCount;

        return {
          ...category,
          subcategories: filteredSubs,
          totalProducts,
        };
      })
    ).then((list) => list.filter(Boolean));

    // Cache for 10 minutes
    cache.set(cacheKey, categoriesWithSubs, 10 * 60 * 1000);

    return res.status(200).json({
      success: true,
      data: categoriesWithSubs,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching categories tree",
      error: error.message,
    });
  }
};

// Get single category details with subcategories - with caching
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cacheKey = `customer-category-${id}`;

    // Try cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
      });
    }

    console.log(`[getCategoryById] Looking for category with id/slug: ${id}`);
    let category;

    // Try to find by ObjectId first (only active categories for public endpoint)
    if (mongoose.Types.ObjectId.isValid(id)) {
      category = await Category.findById(id).lean();
    }

    // If not found by ID, try by slug or name (keeping existing logic for friendliness)
    if (!category) {
      category = await Category.findOne({
        slug: id,
        status: "Active",
      }).lean();

      if (!category) {
        category = await Category.findOne({
          slug: { $regex: new RegExp(`^${id}$`, "i") },
          status: "Active",
        }).lean();
      }

      if (!category) {
        let namePattern = id.replace(/[-_]/g, " ");
        category = await Category.findOne({
          name: { $regex: new RegExp(`^${namePattern}$`, "i") },
          status: "Active",
        }).lean();

        if (!category && id.includes("and")) {
           const withAmpersand = id.replace(/-and-/g, " & ").replace(/-/g, " ");
           category = await Category.findOne({
             name: { $regex: new RegExp(`^${withAmpersand}$`, "i") },
             status: "Active",
           }).lean();
        }
      }
    }

    // If found, check if it's actually a subcategory (has parentId) in the new structure
    if (category && category.parentId) {
      const parentId = category.parentId;
      const parentCategory = await Category.findById(parentId).lean();
      
      if (parentCategory) {
        console.log(`[getCategoryById] Item ${id} is a subcategory of ${parentCategory.name}`);
        
        // Fetch siblings (all children of this parent)
        const subcategories = await Category.find({
          parentId: { $in: [parentId, parentId.toString()] },
          status: "Active"
        })
          .select("name image order slug icon")
          .sort({ order: 1 });

        return res.status(200).json({
          success: true,
          data: {
            category: parentCategory,
            subcategories,
            currentSubcategory: category,
          },
        });
      }
    }

    if (!category) {
      // Check legacy SubCategory model fallback
      if (mongoose.Types.ObjectId.isValid(id)) {
        const subcategory = await SubCategory.findById(id).lean();
        if (subcategory) {
          const parent = await Category.findById(subcategory.category).lean();
          if (parent) {
            const subcategories = await SubCategory.find({
              category: parent._id,
            })
              .select("name image order category")
              .sort({ order: 1 });

            return res.status(200).json({
              success: true,
              data: {
                category: parent,
                subcategories,
                currentSubcategory: subcategory,
              },
            });
          }
        }
      }

      console.log(`[getCategoryById] Category/Subcategory not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: `Category not found: ${id}`,
      });
    }

    console.log(
      `[getCategoryById] Found category: ${category.name} (${category._id})`
    );

    let finalCategory = category;
    let currentSubcategory = null;
    let subcategories = [];

    // If the found category has a parentId, it's actually a subcategory
    if (category.parentId) {
      const parent = await Category.findOne({ _id: category.parentId, status: "Active" }).lean();
      if (parent) {
        finalCategory = parent;
        currentSubcategory = category;
        // Fetch sibling subcategories
        subcategories = await Category.find({
          parentId: parent._id,
          status: "Active"
        })
          .select("name image order slug icon")
          .sort({ order: 1 });
      } else {
        // Fallback if parent not found or inactive
        subcategories = await Category.find({
          parentId: category._id,
          status: "Active"
        })
          .select("name image order slug icon")
          .sort({ order: 1 });
      }
    } else {
      // It's a root category, fetch its subcategories
      subcategories = await Category.find({
        parentId: category._id,
        status: "Active"
      })
        .select("name image order slug icon")
        .sort({ order: 1 });
    }

    const responseData = {
      category: finalCategory,
      subcategories,
      currentSubcategory,
    };

    // Cache for 10 minutes
    cache.set(cacheKey, responseData, 10 * 60 * 1000);

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching category details",
      error: error.message,
    });
  }
};
