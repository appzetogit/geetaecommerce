import { Request, Response } from "express";
import Order from "../../../models/Order";
import Product from "../../../models/Product";
// import Category from "../../../models/Category";
// import Category from "../../../models/Category";
import OrderItem from "../../../models/OrderItem";
import { asyncHandler } from "../../../utils/asyncHandler";
import mongoose from "mongoose";

/**
 * Get seller's dashboard statistics
 */
export const getDashboardStats = asyncHandler(
    async (req: Request, res: Response) => {
        const sellerId = new mongoose.Types.ObjectId((req as any).user.userId);

        // Find orders associated with this seller
        // Since Order model doesn't have sellerId, we find orders via OrderItem
        const sellerOrderItems = await OrderItem.find({ seller: sellerId }).select('order');
        const sellerOrderIds = [...new Set(sellerOrderItems.map(item => item.order.toString()))];

        // 1. KPI Metrics
        const [
            totalOrders,
            completedOrders,
            pendingOrders,
            cancelledOrders,
            totalProduct,
            totalCategoryCount,
            totalSubcategoryCount,
            totalCustomerCount,
        ] = await Promise.all([
            Order.countDocuments({ _id: { $in: sellerOrderIds } }),
            Order.countDocuments({ _id: { $in: sellerOrderIds }, status: "Delivered" }),
            Order.countDocuments({ _id: { $in: sellerOrderIds }, status: "Pending" }),
            Order.countDocuments({ _id: { $in: sellerOrderIds }, status: "Cancelled" }),
            Product.countDocuments({ seller: sellerId }), // Note: Product model uses 'seller' (ref) or 'sellerId'? Checking schema... Product.ts usually uses 'seller' as ref. Checking prev file... Product.countDocuments({ sellerId }) was used. Let's verify Product model.
            Product.distinct("category", { seller: sellerId }).then(ids => ids.length),
            Product.distinct("subcategory", { seller: sellerId }).then(ids => ids.length),
            Order.distinct("customer", { _id: { $in: sellerOrderIds } }).then(ids => ids.length),
        ]);

        // 2. Alert Metrics (Low Stock < 5)
        // Check Product model usage
        const products = await Product.find({ seller: sellerId });
        let soldOutProducts = 0;
        let lowStockProducts = 0;

        products.forEach(product => {
            let isSoldOut = true;
            let isLowStock = false;

            if (product.variations && product.variations.length > 0) {
                product.variations.forEach(v => {
                    if ((v.stock || 0) > 0) isSoldOut = false;
                    if ((v.stock || 0) > 0 && (v.stock || 0) < 5) isLowStock = true;
                    if (v.stock && v.stock > 0) isSoldOut = false;
                    if (v.stock && v.stock > 0 && v.stock < 5) isLowStock = true;
                });
            } else {
                // Handle products without variations (fallback)
                if (product.stock > 0) isSoldOut = false;
                if (product.stock > 0 && product.stock < 5) isLowStock = true;
            }

            if (isSoldOut) soldOutProducts++;
            else if (isLowStock) lowStockProducts++;
        });

        // 3. New Orders Table (Latest 10)
        const newOrders = await Order.find({ _id: { $in: sellerOrderIds } })
            .sort({ createdAt: -1 })
            .limit(10);

        const formattedNewOrders = newOrders.map(order => ({
            id: order.orderNumber || order._id.toString(), // Use orderNumber if available
            orderDate: new Date(order.orderDate).toLocaleDateString('en-GB'),
            status: order.status === 'Out for Delivery' ? 'Out For Delivery' : order.status,
            amount: order.total, // Use total instead of grandTotal (check Schema)
        }));

        // 4. Chart Data (Last 12 months)
        const currentYear = new Date().getFullYear();
        const monthlyStats = await Order.aggregate([
            {
                $match: {
                    _id: { $in: sellerOrderIds.map(id => new mongoose.Types.ObjectId(id)) },
                    orderDate: {
                        $gte: new Date(`${currentYear}-01-01`),
                        $lte: new Date(`${currentYear}-12-31`)
                    }
                }
            },
            {
                $group: {
                    _id: { $month: "$orderDate" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const yearlyOrderData = months.map((month, index) => {
            const monthStat = monthlyStats.find(s => s._id === index + 1);
            return { date: month, value: monthStat ? monthStat.count : 0 };
        });

        // 5. Daily Chart Data (Current Month)
        const currentMonth = new Date().getMonth();
        const dailyStats = await Order.aggregate([
            {
                $match: {
                    _id: { $in: sellerOrderIds.map(id => new mongoose.Types.ObjectId(id)) },
                    orderDate: {
                        $gte: new Date(currentYear, currentMonth, 1),
                        $lte: new Date(currentYear, currentMonth + 1, 0)
                    }
                }
            },
            {
                $group: {
                    _id: { $dayOfMonth: "$orderDate" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const dailyOrderData = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dayStat = dailyStats.find(s => s._id === day);
            return { date: day.toString(), value: dayStat ? dayStat.count : 0 };
        });

        return res.status(200).json({
            success: true,
            message: "Dashboard stats fetched successfully",
            data: {
                stats: {
                    totalUser: totalCustomerCount,
                    totalCategory: totalCategoryCount,
                    totalSubcategory: totalSubcategoryCount,
                    totalProduct,
                    totalOrders,
                    completedOrders,
                    pendingOrders,
                    cancelledOrders,
                    soldOutProducts,
                    lowStockProducts,
                    yearlyOrderData,
                    dailyOrderData
                },
                newOrders: formattedNewOrders
            }
        });
    }
);

/**
 * Get sales summary for seller
 */
export const getSalesSummaryController = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const sellerId = new mongoose.Types.ObjectId((req as any).user.userId);

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);

    const data = await getSellerSalesSummary(sellerId, start, end);

    return res.status(200).json({
      success: true,
      message: "Sales summary fetched successfully",
      data,
    });
  }
);

// Helper function for Sales Summary Logic (Seller Scoped)
const getSellerSalesSummary = async (sellerId: any, startDate: Date, endDate: Date) => {
    // Calculate previous period
    const duration = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime());
    const prevStartDate = new Date(prevEndDate.getTime() - duration);

    const getStats = async (start: Date, end: Date) => {
         const data = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: start, $lte: end },
                    status: { $nin: ["Cancelled", "Rejected", "Returned"] }
                }
            },
            {
                $lookup: {
                    from: "orderitems",
                    localField: "items",
                    foreignField: "_id",
                    as: "sellerItems"
                }
            },
            {
                $project: {
                    orderDate: 1,
                    status: 1,
                    paymentStatus: 1,
                    paymentMethod: 1,
                    total: 1,
                    sellerItems: {
                        $filter: {
                            input: "$sellerItems",
                            as: "item",
                            cond: { $eq: ["$$item.seller", sellerId] }
                        }
                    }
                }
            },
            {
                $match: {
                    "sellerItems.0": { $exists: true }
                }
            },
            {
                $addFields: {
                    sellerTotal: { $sum: "$sellerItems.total" }
                }
            },
             {
                $group: {
                  _id: null,
                  totalSales: { $sum: "$sellerTotal" },
                  totalOrders: { $sum: 1 },
                  paidAmount: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ["$paymentStatus", "Paid"] },
                            { $in: ["$paymentMethod", ["PAID", "COD", "Cash", "Razorpay", "Cashfree"]] }
                          ]
                        },
                        "$sellerTotal",
                        0,
                      ],
                    },
                  },
                  creditAmount: {
                    $sum: {
                        $cond: [
                            { $eq: ["$paymentMethod", "CREDIT"] },
                            "$sellerTotal",
                            0
                        ]
                    }
                  }
                }
             }
         ]);
        return data[0] || { totalSales: 0, totalOrders: 0, paidAmount: 0, creditAmount: 0 };
    };

    const currentStats = await getStats(startDate, endDate);
    const prevStats = await getStats(prevStartDate, prevEndDate);

    const calculateChange = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prev) / prev) * 100);
    };

    // Daily Sales & Profit
    const detailedData = await Order.aggregate([
         {
            $match: {
                orderDate: { $gte: startDate, $lte: endDate },
                status: { $nin: ["Cancelled", "Rejected", "Returned"] }
            }
        },
        {
            $lookup: {
                from: "orderitems",
                localField: "items",
                foreignField: "_id",
                as: "sellerItems"
            }
        },
        {
            $project: {
                orderDate: 1,
                items: 1,
                sellerItems: {
                    $filter: {
                        input: "$sellerItems",
                        as: "item",
                        cond: { $eq: ["$$item.seller", sellerId] }
                    }
                }
            }
        },
        { $match: { "sellerItems.0": { $exists: true } } },
        {
            $facet: {
                dailySales: [
                    { $unwind: "$sellerItems" },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                            sales: { $sum: "$sellerItems.total" },
                            orders: { $addToSet: "$_id" }
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            sales: 1,
                            orders: { $size: "$orders" }
                        }
                    },
                    { $sort: { _id: 1 } }
                ],
                profitData: [
                     { $unwind: "$sellerItems" },
                     {
                        $lookup: {
                            from: "products",
                            localField: "sellerItems.product",
                            foreignField: "_id",
                            as: "productDetails"
                        }
                     },
                     {
                        $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true }
                     },
                     {
                        $group: {
                            _id: null,
                            totalRevenue: { $sum: "$sellerItems.total" },
                             totalCost: {
                                $sum: {
                                    $multiply: [
                                        { $ifNull: ["$productDetails.purchasePrice", "$sellerItems.unitPrice"] },
                                        "$sellerItems.quantity"
                                    ]
                                }
                            }
                        }
                     }
                ]
            }
        }
    ]);

    const profitInfo = detailedData[0]?.profitData[0] || { totalRevenue: 0, totalCost: 0 };
    const totalProfit = profitInfo.totalRevenue - profitInfo.totalCost;

    // Daily Filling
     const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dailyMap = new Map();
    (detailedData[0]?.dailySales || []).forEach((item: any) => {
      dailyMap.set(item._id, item);
    });

    const dailyData = [];
    const curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
      const dateStr = curr.toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr);
      dailyData.push({
        day: days[curr.getDay()],
        date: dateStr,
        sales: existing ? existing.sales : 0,
        orders: existing ? existing.orders : 0,
      });
      curr.setDate(curr.getDate() + 1);
    }

    return {
      summary: {
        totalSales: currentStats.totalSales,
        totalSalesChange: calculateChange(currentStats.totalSales, prevStats.totalSales),
        totalOrders: currentStats.totalOrders,
        totalOrdersChange: calculateChange(currentStats.totalOrders, prevStats.totalOrders),
        paidAmount: currentStats.paidAmount,
        paidAmountChange: calculateChange(currentStats.paidAmount, prevStats.paidAmount),
        creditAmount: currentStats.creditAmount,
        creditAmountChange: calculateChange(currentStats.creditAmount, prevStats.creditAmount),
        totalProfit,
        totalLoss: totalProfit < 0 ? Math.abs(totalProfit) : 0,
        netProfit: totalProfit > 0 ? totalProfit : 0
      },
      dailySales: dailyData,
    };
};
