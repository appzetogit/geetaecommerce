import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Customer from "../../../models/Customer";
import Order from "../../../models/Order";

/**
 * Get all customers with filters
 */
export const getAllCustomers = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      hasDue,
      hasAdvance,
      sortBy = "registrationDate",
      sortOrder = "desc",
    } = req.query;

    const query: any = {};
    if (status) query.status = status;

    if (hasDue === "true") {
      query.creditBalance = { $gt: 0 };
    } else if (hasAdvance === "true") {
      query.creditBalance = { $lt: 0 };
    }

    // Filter by sellerId to separate Admin and Seller customers
    if (req.user && req.user.userType === "Seller") {
      query.sellerId = req.user.userId;
    } else if (req.user && req.user.userType === "Admin") {
      // For Admin, only show Admin-created/Global customers in POS context
      // If we are in the main Admin Customers list, we might want to see all,
      // but the user said "admin wale seller ko show na ho dono ko alag alag manage karna hai"
      // and "seller wale admin ko show nahi ho".
      // This implies Admin should only see Admin customers.
      query.sellerId = null;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search as string, $options: "i" } },
        { email: { $regex: search as string, $options: "i" } },
        { phone: { $regex: search as string, $options: "i" } },
        { refCode: { $regex: search as string, $options: "i" } },
      ];
    }

    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit as string)),
      Customer.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Customers fetched successfully",
      data: customers,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Get customer by ID
 */
export const getCustomerById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer fetched successfully",
      data: customer,
    });
  }
);

/**
 * Update customer status
 */
export const updateCustomerStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Active", "Inactive", "Suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Active, Inactive, or Suspended",
      });
    }

    const customer = await Customer.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer status updated successfully",
      data: customer,
    });
  }
);

/**
 * Get customer orders
 */
export const getCustomerOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const query: any = { customer: id };
    if (status) query.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("items")
        .populate("deliveryBoy", "name mobile")
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Order.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Customer orders fetched successfully",
      data: orders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Create a new customer
 */
export const createCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, email, phone, address, city, state, pincode } = req.body;
    // Accept both `gst` and `gstNumber` from frontend and normalize.
    const rawGst = (req.body.gst ?? req.body.gstNumber ?? "") as string;
    const gst = rawGst
      ? String(rawGst).toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15)
      : "";

    // Check if customer already exists within this context (Same Seller/Admin)
    const contextQuery: any = {
      $or: [{ phone }],
      sellerId: req.user && req.user.userType === 'Seller' ? req.user.userId : null,
    };
    if (email) contextQuery.$or.push({ email });

    const existingInContext = await Customer.findOne(contextQuery);

    if (existingInContext) {
      return res.status(400).json({
        success: false,
        message: existingInContext.phone === phone
          ? "Customer with this phone number is already registered in your list"
          : "Customer with this email is already registered in your list",
      });
    }

    try {
      const customer = await Customer.create({
        name,
        email: email || undefined, // Store undefined instead of empty string
        phone,
        address,
        city,
        state,
        pincode,
        gst,
        registrationDate: new Date(),
        status: 'Active',
        sellerId: req.user && req.user.userType === 'Seller' ? req.user.userId : null,
      });
  
      return res.status(201).json({
        success: true,
        message: "Customer created successfully",
        data: customer,
      });
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "This phone number or email is already registered in the system. To maintain separate lists, please use a unique identifier or contact admin to resolve index conflicts.",
        });
      }
      throw error; // Rethrow other errors to be handled by global error handler
    }
  }
);

/**
 * Delete a customer
 */
export const deleteCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const query: any = { _id: id };
    
    // Ensure Seller can only delete their own customers
    if (req.user && req.user.userType === 'Seller') {
      query.sellerId = req.user.userId;
    } else if (req.user && req.user.userType === 'Admin') {
      // Admin deletes global/admin customers
      query.sellerId = null;
    }

    const customer = await Customer.findOneAndDelete(query);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or you don't have permission to delete it",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  }
);

