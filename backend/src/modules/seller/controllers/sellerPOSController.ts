
import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Product from "../../../models/Product";
import Customer from "../../../models/Customer";
import StockLedger from "../../../models/StockLedger";
import CreditTransaction from "../../../models/CreditTransaction";
// import { notifySellersOfOrderUpdate } from "../../../services/sellerNotificationService";

// ... existing code ...

/**
 * Get all products for POS billing (Seller View - Global Catalog)
 * This allows sellers to search and sell ANY active product in the system.
 */
export const getPOSProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { search, category, brand } = req.query;
    const query: any = { status: "Active" };

    if (category) query.category = category;
    if (brand) query.brand = brand;

    // Note: We are deliberately NOT filtering by seller: sellerId here
    // based on the requirement to mimic Admin POS search capability.
    // If stricta seller-only inventory is needed later, uncomment:
    // query.seller = (req as any).user.userId;

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
      .select("productName mainImage price compareAtPrice wholesalePrice purchasePrice discPrice stock sku variations category barcode itemCode seller")
      .populate("category", "name")
      .sort({ productName: 1 })
      .limit(100); // Limit results for performance

    return res.status(200).json({
      success: true,
      message: "POS products fetched successfully",
      data: products
    });
  }
);

/**
 * Create POS Order for Seller
 */
export const createPOSOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { items, paymentMethod, paymentStatus } = req.body;
        let { customerId } = req.body;
        const sellerId = (req as any).user.userId;

        if (!sellerId) {
             throw new Error("Seller not identified");
        }

        // Validate request
        if (!customerId || !items || !items.length || !paymentMethod) {
          return res.status(400).json({
            success: false,
            message: "Missing required fields: customerId, items, paymentMethod",
          });
        }

        // Handle Walk-in Customer
        if (customerId === "walk-in-customer") {
          let walkIn = await Customer.findOne({ email: "walkin@pos.com" }).session(session);
          if (!walkIn) {
               try {
                  walkIn = await Customer.create([{
                    name: "Walk-in Customer",
                    email: "walkin@pos.com",
                    phone: "0000000000",
                    status: "Active",
                  }], { session }) as any;
                  walkIn = walkIn[0];
               } catch (e) {
                   walkIn = await Customer.findOne({ email: "walkin@pos.com" }).session(session);
               }
          }
          if (walkIn) customerId = walkIn._id;
        }

        // Fetch customer
        const customer = await Customer.findById(customerId).session(session);
        if (!customer) {
          return res.status(404).json({
            success: false,
            message: "Customer not found",
          });
        }

        const order = new Order({
          customer: customer._id,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          deliveryAddress: {
            address: customer.address || "POS Order",
            city: customer.city || "POS",
            pincode: customer.pincode || "000000",
            state: customer.state || "POS"
          },
          items: [],
          subtotal: 0,
          tax: 0,
          shipping: 0,
          discount: 0,
          total: 0,
          paymentMethod,
          paymentStatus: paymentStatus || "Paid",
          status: "Delivered",
          deliveryBoyStatus: "Delivered",
          deliveredAt: new Date(),
          adminNotes: `POS Order - Seller: ${sellerId}`
        });

        let subtotal = 0;
        const orderItemsIds = [];

        for (const item of items) {
           if (!mongoose.Types.ObjectId.isValid(item.productId)) {
               throw new Error(`Invalid Product ID: ${item.productId}`);
           }

           // Allow selling ANY active product (matches getPOSProducts global search)
           // But we need to handle stock deduction correctly.
           // If product is NOT owned by seller, we still deduct stock from that product?
           // Yes, assuming shared inventory or marketplace model where seller is an agent.
           const product = await Product.findOne({ _id: item.productId }).session(session);

           if (!product) {
               throw new Error(`Product not found: ${item.name} (${item.productId})`);
           }

           // Optional: Warn if selling other's product?
           // if (product.seller && product.seller.toString() !== sellerId) { ... }

           const soldQty = Number(item.quantity) || 0;
           const unitPrice = Number(item.price);
           const totalItemPrice = unitPrice * soldQty;
           subtotal += totalItemPrice;

           let productData = {
               productName: product.productName,
               mainImage: product.mainImage,
               sku: product.sku
           };

           // Verify and Deduct Stock
           const prevStock = product.stock;
           let sku = product.sku;
           let varId = null;

           if (item.variationId && product.variations) {
               const variationIndex = product.variations.findIndex((v: any) => v._id?.toString() === item.variationId.toString());
               if (variationIndex > -1) {
                   const prevVarStock = product.variations[variationIndex].stock || 0;
                   product.variations[variationIndex].stock = Math.max(0, prevVarStock - soldQty);
                   product.stock = Math.max(0, prevStock - soldQty);
                   sku = product.variations[variationIndex].sku || sku;
                   varId = product.variations[variationIndex]._id;

                   // Ledger for Variation
                   await StockLedger.create([{
                       product: product._id,
                       variationId: varId,
                       sku: sku,
                       quantity: soldQty,
                       type: "OUT",
                       source: "POS",
                       referenceId: order._id,
                       previousStock: prevVarStock,
                       newStock: product.variations[variationIndex].stock,
                       seller: sellerId // We log the SELLER who sold it, even if product owner is different
                   }], { session });
               }
           } else {
               product.stock = Math.max(0, prevStock - soldQty);
               await StockLedger.create([{
                   product: product._id,
                   sku: sku,
                   quantity: soldQty,
                   type: "OUT",
                   source: "POS",
                   referenceId: order._id,
                   previousStock: prevStock,
                   newStock: product.stock,
                   seller: sellerId
               }], { session });
           }

           await product.save({ session });

           const orderItem = new OrderItem({
             order: order._id,
             product: product._id,
             seller: product.seller || sellerId, // Credit the original product owner?? Or the seller who sold it?
                                                 // Usually OrderItem.seller reflects who gets the money/credit.
                                                 // If I sell Admin's product, does Admin get credit?
                                                 // For POS, typically the Cashier (Seller) records the sale.
                                                 // We'll set it to the logged-in Seller for report grouping.
                                                 // But this might mess up multi-vendor logic.
                                                 // For now, adhere to "POS Order - Seller: ID" logic.
             productName: productData.productName,
             productImage: productData.mainImage,
             sku: sku,
             unitPrice: unitPrice,
             quantity: soldQty,
             total: totalItemPrice,
             status: "Delivered",
             variation: item.variationId
           });

           if (varId) {
                const v = product.variations.find((v:any) => v._id.toString() === varId.toString());
                if (v) orderItem.variation = `${v.name || 'Variation'}: ${v.value}`;
           }

           await orderItem.save({ session });
           orderItemsIds.push(orderItem._id);
        }

        order.items = orderItemsIds as any;
        order.subtotal = subtotal;
        order.total = subtotal;

        if (paymentMethod === 'Credit') {
            order.paymentStatus = 'Pending';
        }

        await order.save({ session });

        if (paymentMethod === 'Credit') {
            customer.creditBalance = (customer.creditBalance || 0) + order.total;
            await customer.save({ session });

            await CreditTransaction.create([{
                customer: customer._id,
                type: 'Order',
                amount: order.total,
                balanceAfter: customer.creditBalance,
                description: `POS Order #${order.orderNumber} (Seller)`,
                referenceId: order._id.toString(),
                date: new Date(),
                createdBy: sellerId
            }], { session });
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(201).json({
            success: true,
            message: "POS Order created successfully",
            data: order
        });

    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        console.error("Seller createPOSOrder CRASH:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
  }
);

export const initiatePOSOnlineOrder = asyncHandler(
  async (req: Request, res: Response) => {
      return res.status(200).json({
          success: true,
          message: "Online order initiated (Mock)",
          order_id: "order_" + Date.now(),
          amount: req.body.amount,
          currency: "INR"
      });
  }
);

export const verifyPOSPayment = asyncHandler(
    async (req: Request, res: Response) => {
        req.body.paymentStatus = "Paid";
        return createPOSOrder(req, res, () => {});
    }
);

export const getPOSReport = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { start, end } = req.query;

    const summaryQuery: any = {
       'adminNotes': { $regex: 'POS', $options: 'i' },
    };

    summaryQuery.adminNotes = { $regex: `POS Order - Seller: ${sellerId}`, $options: 'i' };

    if (start && end) {
        summaryQuery.orderDate = {
            $gte: new Date(start as string),
            $lte: new Date(end as string)
        };
    }

    const summary = await Order.aggregate([
      { $match: summaryQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          totalOrders: { $count: {} },
          cashSales: {
            $sum: { $cond: [{ $eq: ["$paymentMethod", "Cash"] }, "$total", 0] }
          },
          onlineSales: {
            $sum: { $cond: [{ $ne: ["$paymentMethod", "Cash"] }, "$total", 0] }
          },
          unpaidAmount: {
             $sum: { $cond: [{ $eq: ["$paymentStatus", "Pending"] }, "$total", 0] }
          }
        }
      }
    ]);

    const recentOrders = await Order.find({ ...summaryQuery })
      .sort({ orderDate: -1 })
      .limit(50)
      .populate("customer", "name phone");

    return res.status(200).json({
      success: true,
      data: {
        summary: summary[0] || { totalSales: 0, totalOrders: 0, cashSales: 0, onlineSales: 0, unpaidAmount: 0 },
        orders: recentOrders
      }
    });
  }
);

export const getPOSStockLedger = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { page = 1, limit = 50, productId, type, startDate, endDate } = req.query;

    const query: any = { seller: sellerId };

    if (productId) query.product = productId;
    if (type) query.type = type;

    if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        query.createdAt = { $gte: start, $lte: end };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [ledger, total] = await Promise.all([
      StockLedger.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string))
        .populate("product", "productName mainImage sku"),
      StockLedger.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: ledger,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  }
);
