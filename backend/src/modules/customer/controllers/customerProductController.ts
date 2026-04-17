import { Request, Response } from "express";
import Product from "../../../models/Product";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import HeaderCategory from "../../../models/HeaderCategory";
import mongoose from "mongoose";
import Seller from "../../../models/Seller"; // Import Seller model
import Brand from "../../../models/Brand";
import AppSettings from "../../../models/AppSettings";
import { findSellersWithinRange } from "../../../utils/locationHelper";

// Get products with filtering options (public)
export const getProducts = async (req: Request, res: Response) => {
  try {
    const {
      category,
      subcategory,
      search,
      page = 1,
      limit = 20,
      sort,
      minPrice,
      maxPrice,
      brand,
      minDiscount,
      headerCategorySlug,
      latitude, // User location latitude
      longitude, // User location longitude
    } = req.query;

    console.log("DEBUG: getProducts called with query:", req.query);

    const settings = await AppSettings.findOne().lean();
    const inventorySection = settings?.productDisplaySettings?.find(s => s.id === 'inventory');
    const negativeStockSoldOut = inventorySection?.fields?.find(f => f.id === 'negative_stock_sold_out')?.isEnabled;

    const query: any = {
      status: "Active",
      publish: true,
    };

    // Use $and array to combine conditions safely without overwriting $or blocks
    const andConditions: any[] = [
      {
        $or: [
          { isShopByStoreOnly: { $ne: true } },
          { isShopByStoreOnly: { $exists: false } },
        ],
      }
    ];

    if (negativeStockSoldOut) {
      query.stock = { $gt: 0 };
    }

    // Location-based filtering
    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;

    if (userLat && userLng && !isNaN(userLat) && !isNaN(userLng)) {
      let allowedSellerIds = await findSellersWithinRange(userLat, userLng);
      try {
        const adminSellers = await Seller.find({
          $or: [
            { email: /admin/i },
            { category: "Admin" },
            { storeName: { $regex: /Admin/i } }
          ]
        }).select("_id");
        const adminSellerIds = adminSellers.map(s => s._id);
        allowedSellerIds = [...allowedSellerIds, ...adminSellerIds];
      } catch (err) {
        console.error("Error fetching admin seller:", err);
      }

      const enabledSellers = await Seller.find({
        _id: { $in: allowedSellerIds },
        isEnabled: true
      }).select("_id");
      query.seller = { $in: enabledSellers.map(s => s._id) };
    } else {
       const enabledSellers = await Seller.find({ isEnabled: true }).select("_id");
       query.seller = { $in: enabledSellers.map(s => s._id) };
    }

    // Helper to resolve ID
    const resolveId = async (model: any, value: string, modelName: string = "") => {
      if (mongoose.Types.ObjectId.isValid(value)) {
        try {
          return new mongoose.Types.ObjectId(value);
        } catch (e) {
          return value;
        }
      }
      const baseQuery: any = {};
      if (modelName === "Category") baseQuery.status = "Active";
      let item = await model.findOne({ ...baseQuery, slug: value }).select("_id").lean();
      if (item) return item._id;
      item = await model.findOne({ ...baseQuery, slug: { $regex: new RegExp(`^${value}$`, "i") } }).select("_id").lean();
      if (item) return item._id;
      let namePattern = value.replace(/[-_]/g, " ");
      item = await model.findOne({ ...baseQuery, name: { $regex: new RegExp(`^${namePattern}$`, "i") } }).select("_id").lean();
      if (item) return item._id;
      if (modelName === "Category" && value.includes("and")) {
         const withAmpersand = value.replace(/-and-/g, " & ").replace(/-/g, " ");
         item = await model.findOne({ ...baseQuery, name: { $regex: new RegExp(`^${withAmpersand}$`, "i") } }).select("_id").lean();
         if (item) return item._id;
      }
      return null;
    };

    if (category) {
      const categoryId = await resolveId(Category, category as string, "Category");
      if (categoryId) {
        // Include products from all sub-categories (descendants)
        const catDoc = await Category.findById(categoryId);
        if (catDoc) {
          const descendants = await catDoc.getAllDescendants();
          const allCategoryIds = [catDoc._id, ...descendants.map(d => d._id)];
          andConditions.push({ category: { $in: allCategoryIds } });
        } else {
          andConditions.push({ category: categoryId });
        }
      }
    }

    if (headerCategorySlug && headerCategorySlug !== "all") {
      const header = await HeaderCategory.findOne({ slug: headerCategorySlug, status: "Published" }).select("_id").lean();
      if (header?._id) {
        const roots = await Category.find({ headerCategoryId: header._id, status: "Active" }).select("_id").lean();
        const rootIds = roots.map((c: any) => c._id);
        const children = rootIds.length ? await Category.find({ parentId: { $in: rootIds }, status: "Active" }).select("_id").lean() : [];
        const allIds = [...rootIds, ...children.map((c: any) => c._id)];
        andConditions.push({ category: { $in: allIds } });
      } else {
        andConditions.push({ category: { $in: [] } });
      }
    }

    if (subcategory) {
      let subcategoryId = await resolveId(Category, subcategory as string, "Category");
      if (!subcategoryId) {
        subcategoryId = await resolveId(SubCategory, subcategory as string, "SubCategory");
      }
      if (subcategoryId) {
        // Product might have the subcategory ID in either the 'category' (if leaf node) or 'subcategory' field
        andConditions.push({
          $or: [
            { subcategory: subcategoryId },
            { category: subcategoryId }
          ]
        });
      }
    }

    if (brand) {
      query.brand = brand;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (minDiscount) {
      query.discount = { $gte: Number(minDiscount) };
    }

    if (search) {
      const searchRegex = { $regex: search as string, $options: "i" };
      andConditions.push({
        $or: [
          { productName: searchRegex },
          { smallDescription: searchRegex },
          { tags: searchRegex },
          { sku: searchRegex },
          { barcode: searchRegex },
          { "variations.sku": searchRegex },
          { "variations.barcode": searchRegex }
        ]
      });
    }

    // Apply combined conditions to the final query
    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // Calculate skip for pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Build sort object
    let sortOptions: any = { createdAt: -1 }; // Default new to old
    if (sort === "price_asc") sortOptions = { price: 1 };
    if (sort === "price_desc") sortOptions = { price: -1 };
    if (sort === "discount") sortOptions = { discount: -1 };
    if (sort === "popular") sortOptions = { popular: -1, dealOfDay: -1 };

    console.log("DEBUG: Final search query:", JSON.stringify(query));

    const products = await Product.find(query)
      .populate("category", "name icon image")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .populate("seller", "storeName")
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

// Get search suggestions (public)
export const getSearchSuggestions = async (req: Request, res: Response) => {
  try {
    const { q, latitude, longitude } = req.query;
    console.log("DEBUG: getSearchSuggestions called with q:", q, "at", latitude, longitude);

    if (!q || typeof q !== 'string') {
      return res.status(200).json({ success: true, data: [] });
    }

    const searchRegex = { $regex: q, $options: "i" };
    const query: any = {
      status: "Active",
      publish: true,
      $or: [
        { productName: searchRegex },
        { tags: searchRegex },
        { sku: searchRegex },
        { barcode: searchRegex },
        { "variations.sku": searchRegex },
        { "variations.barcode": searchRegex }
      ]
    };

    // Location-based filtering for suggestions too
    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;

    if (userLat && userLng && !isNaN(userLat) && !isNaN(userLng)) {
      let allowedSellerIds = await findSellersWithinRange(userLat, userLng);
      // Add Admin Sellers
      const adminSellers = await Seller.find({
        $or: [
          { category: "Admin" },
          { storeName: { $regex: /Admin/i } }
        ]
      }).select("_id");
      allowedSellerIds = [...allowedSellerIds, ...adminSellers.map(s => s._id)];
      query.seller = { $in: allowedSellerIds };
      console.log(`DEBUG: Suggestions filtering for ${allowedSellerIds.length} sellers`);
    }

    const products = await Product.find(query)
      .select("productName _id mainImage category price discPrice variations unitPricing mrp discount compareAtPrice")
      .populate("category", "name")
      .limit(10)
      .lean();

    console.log(`DEBUG: Found ${products.length} matching products for suggestions`);

    // Also search for categories
    const categories = await Category.find({
      name: searchRegex,
      status: "Active"
    }).limit(3).select("name _id image").lean();

    const suggestions = [
      { id: 'search', name: q, type: 'search', image: null },
      ...products.map((p: any) => ({
        id: p._id,
        name: p.productName,
        type: 'product',
        image: p.mainImage,
        categoryName: p.category?.name,
        price: p.price,
        mrp: p.compareAtPrice || p.mrp || p.price,
        discount: p.discount
      })),
      ...categories.map(c => ({ id: c._id, name: c.name, type: 'category', image: c.image }))
    ];

    return res.status(200).json({
      success: true,
      data: suggestions
    });
  } catch (error: any) {
    console.error("ERROR: getSearchSuggestions:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching suggestions",
      error: error.message
    });
  }
};

// Get single product by ID (public)
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.query; // User location

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: id,
      status: "Active",
      publish: true,
    })
      .populate("category", "name")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .populate(
        "seller",
        "storeName city fssaiLicNo address location serviceRadiusKm email isEnabled"
      ); // Added email to selection to check if it's admin, and isEnabled for online visibility status

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unavailable",
      });
    }

    // Check Negative Stock Setting
    const settings = await AppSettings.findOne().lean();
    const inventorySection = settings?.productDisplaySettings?.find(s => s.id === 'inventory');
    const negativeStockSoldOut = inventorySection?.fields?.find(f => f.id === 'negative_stock_sold_out')?.isEnabled;

    if (negativeStockSoldOut && product.stock <= 0) {
      return res.status(404).json({
        success: false,
        message: "Product is currently sold out",
      });
    }

    // Check if seller is enabled
    const sellerInfo = product.seller as any;
    if (sellerInfo && sellerInfo.isEnabled === false) {
      return res.status(404).json({
        success: false,
        message: "This product is currently unavailable",
      });
    }

    // Parse location
    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;
    const seller = product.seller as any;

    // Initialize availability flag
    let isAvailableAtLocation = false;
    let sellerId: mongoose.Types.ObjectId | null = null;

    if (seller) {
      if (typeof seller === "object" && seller._id) {
        // Seller is populated
        sellerId = seller._id;
      } else if (seller instanceof mongoose.Types.ObjectId) {
        // Seller is an ObjectId (not populated)
        sellerId = seller;
      } else if (typeof seller === "string") {
        // Seller is a string ID
        sellerId = new mongoose.Types.ObjectId(seller);
      }
    }

    // Check availability
    // Always available if it's the Admin Store
    if (seller && (
      seller.email === "admin-store@geetastores.com" ||
      seller.category === "Admin" ||
      /Admin/i.test(seller.storeName || "")
    )) {
       isAvailableAtLocation = true;
    }
    // Otherwise check location availability if coordinates are provided
    else if (
      userLat &&
      userLng &&
      !isNaN(userLat) &&
      !isNaN(userLng) &&
      sellerId &&
      seller?.location
    ) {
      const nearbySellerIds = await findSellersWithinRange(userLat, userLng);
      isAvailableAtLocation = nearbySellerIds.some(
        (id) => id.toString() === sellerId!.toString()
      );
    } else if (!userLat || !userLng) {
       // If user has no location set, assume available (browsing mode)
       // Or depends on business logic; here we default to false if location is mandatory,
       // but typically we allowed it above in getProducts warning.
       // Let's set it to true if no location is provided to allow adding to cart (user will be prompted later or stopped at checkout)
       // But wait, the previous code initialized it to false.
       // If no location provided, we often assume we can't deliver.
       // However, to match the "WARNING: Location missing, showing all products" logic:
       isAvailableAtLocation = true;
    }

    // Find similar products (by category)
    // Filter by location
    const similarProductsQuery: any = {
      _id: { $ne: product._id },
      status: "Active",
      publish: true,
      // Exclude shop-by-store-only products from similar products
      $or: [
        { isShopByStoreOnly: { $ne: true } },
        { isShopByStoreOnly: { $exists: false } },
      ],
    };


    // 1. Identify the most specific category ID for this product
    let specificId = null;
    let parentId = null;

    // Check subcategory field first
    const subcat = product.subcategory as any;
    const subcatId = subcat?._id || (product as any)._doc?.subcategory || product.subcategory;
    
    // Check category field and its parent
    const cat = product.category as any;
    const catId = cat?._id || cat;
    const catParentId = cat?.parentId;

    if (subcatId && mongoose.Types.ObjectId.isValid(subcatId.toString())) {
      specificId = new mongoose.Types.ObjectId(subcatId.toString());
      parentId = catId;
    } else if (catParentId && mongoose.Types.ObjectId.isValid(catId.toString())) {
      // If category has a parent, the category itself is the sub-level
      specificId = new mongoose.Types.ObjectId(catId.toString());
      parentId = catParentId;
    } else {
      specificId = catId;
    }

    // 2. Build the query to match items in the same specific group
    similarProductsQuery.$and = [
      {
        $or: [
          { isShopByStoreOnly: { $ne: true } },
          { isShopByStoreOnly: { $exists: false } },
        ]
      }
    ];

    if (specificId) {
      similarProductsQuery.$and.push({
        $or: [
          { subcategory: specificId },
          { category: specificId }
        ]
      });
    } else if (parentId) {
      similarProductsQuery.$and.push({ category: parentId });
    }

    // Filter similar products by location (allow admin store here too?)
    if (userLat && userLng && !isNaN(userLat) && !isNaN(userLng)) {
      const nearbySellerIds = await findSellersWithinRange(userLat, userLng);

      // Allow Admin seller IDs
      try {
        const adminSellers = await Seller.find({
          $or: [
            { email: "admin-store@geetastores.com" },
            { category: "Admin" },
            { storeName: { $regex: /Admin/i } }
          ]
        }).select("_id");
        const adminSellerIds = adminSellers.map(s => s._id);

        // Combine
        const allowedIds = [...nearbySellerIds, ...adminSellerIds];

         if (allowedIds.length > 0) {
            similarProductsQuery.seller = { $in: allowedIds };
         } else {
             // No sellers nearby
            similarProductsQuery.seller = { $in: [] };
         }
      } catch (e) {
         // fallback
         if (nearbySellerIds.length > 0) {
            similarProductsQuery.seller = { $in: nearbySellerIds };
         }
      }

    }
    const similarProducts = await Product.find(similarProductsQuery)
      .limit(6)
      .select(
        "productName price discPrice variations unitPricing mrp mainImage pack discount _id rating reviewsCount deliveryTime"
      );

    return res.status(200).json({
      success: true,
      data: {
        ...product.toObject(),
        similarProducts,
        isAvailableAtLocation, // Add availability flag to response
      },
    });
  } catch (error: any) {
    console.error("Error in getProductById:", {
      productId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Error fetching product details",
      error: error.message,
    });
  }
};

// Get all brands (public)
export const getAllBrands = async (_req: Request, res: Response) => {
  try {
    const brands = await Brand.find({}).sort({ name: 1 });
    return res.status(200).json({
      success: true,
      data: brands,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching brands",
      error: error.message,
    });
  }
};

// Get brand details (public)
export const getBrandDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID",
      });
    }

    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching brand details",
      error: error.message,
    });
  }
};
