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

        // Find orders associated with this seller via OrderItem
        // Using distinct is more efficient than find().select()
        const sellerOrderIds = await OrderItem.distinct('order', { seller: sellerId });

        // Status groupings
        const pendingStatuses = ["Received", "Pending", "Processed", "Shipped", "Out for Delivery"];
        const completedStatuses = ["Delivered"];
        const cancelledStatuses = ["Cancelled", "Rejected", "Returned"];

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
            Order.countDocuments({ _id: { $in: sellerOrderIds }, status: { $in: completedStatuses } }),
            Order.countDocuments({ _id: { $in: sellerOrderIds }, status: { $in: pendingStatuses } }),
            Order.countDocuments({ _id: { $in: sellerOrderIds }, status: { $in: cancelledStatuses } }),
            Product.countDocuments({ seller: sellerId }),
            Product.distinct("category", { seller: sellerId, category: { $ne: null } }).then(ids => ids.length),
            Product.distinct("subcategory", { seller: sellerId, subcategory: { $ne: null } }).then(ids => ids.length),
            Order.distinct("customer", { _id: { $in: sellerOrderIds } }).then(ids => ids.length),
        ]);

        // 2. Alert Metrics (Low Stock < 5)
        const products = await Product.find({ seller: sellerId });
        let soldOutProducts = 0;
        let lowStockProducts = 0;

        products.forEach(product => {
            let isSoldOut = true;
            let isLowStock = false;

            const lowStockThreshold = product.lowStockQuantity || 5;

            if (product.variations && product.variations.length > 0) {
                product.variations.forEach(v => {
                    const stock = Number(v.stock) || 0;
                    if (stock > 0) isSoldOut = false;
                    if (stock > 0 && stock < lowStockThreshold) isLowStock = true;
                });
            } else {
                const stock = Number(product.stock) || 0;
                if (stock > 0) isSoldOut = false;
                if (stock > 0 && stock < lowStockThreshold) isLowStock = true;
            }

            if (isSoldOut) soldOutProducts++;
            else if (isLowStock) lowStockProducts++;
        });

        // 3. New Orders Table (Latest 20) with Seller-specific totals
        const newOrders = await Order.find({ _id: { $in: sellerOrderIds } })
            .populate({
                path: 'items',
                match: { seller: sellerId }
            })
            .sort({ createdAt: -1 })
            .limit(20);

        const formattedNewOrders = newOrders.map(order => {
            // Calculate total amount for ONLY this seller's items in this order
            const sellerTotal = (order.items as any[] || []).reduce((sum, item) => sum + (item.total || 0), 0);

            return {
                id: order.orderNumber || order._id.toString(),
                orderDate: new Date(order.orderDate).toLocaleDateString('en-GB'),
                status: order.status === 'Out for Delivery' ? 'Out For Delivery' : order.status,
                amount: sellerTotal,
            };
        });

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

        // 1.1 Monetary Metrics (Seller specific)
        const monetaryStats = await OrderItem.aggregate([
            { $match: { seller: sellerId, status: { $nin: ["Cancelled", "Rejected", "Returned"] } } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total" }
                }
            }
        ]);

        const totalRevenue = monetaryStats[0]?.totalRevenue || 0;

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
                    totalRevenue,
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
  // Calculate previous period for comparison
  const duration = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime());
  const prevStartDate = new Date(prevEndDate.getTime() - duration);

  const getStats = async (start: Date, end: Date) => {
    // We start aggregation from OrderItem because it's indexed by seller and more specific
    const data = await OrderItem.aggregate([
      {
        $match: {
          seller: sellerId,
          createdAt: { $gte: start, $lte: end },
          status: { $nin: ["Cancelled", "Returned"] } // Only active items
        }
      },
      {
        $lookup: {
          from: "orders",
          localField: "order",
          foreignField: "_id",
          as: "orderData"
        }
      },
      { $unwind: "$orderData" },
      {
        $match: {
          "orderData.status": { $nin: ["Cancelled", "Rejected", "Returned"] } // Filter out orders that are not valid
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          totalOrders: { $addToSet: "$order" },
          paidAmount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$orderData.paymentStatus", "Paid"] },
                    { $in: [{ $toUpper: "$orderData.paymentMethod" }, ["PAID", "COD", "CASH", "RAZORPAY", "CASHFREE", "ONLINE"]] }
                  ]
                },
                "$total",
                0
              ]
            }
          },
          creditAmount: {
            $sum: {
              $cond: [
                { $eq: [{ $toUpper: "$orderData.paymentMethod" }, "CREDIT"] },
                "$total",
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalSales: 1,
          totalOrders: { $size: "$totalOrders" },
          paidAmount: 1,
          creditAmount: 1
        }
      }
    ]);

    return data[0] || { totalSales: 0, totalOrders: 0, paidAmount: 0, creditAmount: 0 };
  };

  const [currentStats, prevStats] = await Promise.all([
    getStats(startDate, endDate),
    getStats(prevStartDate, prevEndDate)
  ]);

  const calculateChange = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
  };

  // Daily Sales & Profit/Loss Detailed Data
  const detailedData = await OrderItem.aggregate([
    {
      $match: {
        seller: sellerId,
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $nin: ["Cancelled", "Returned"] }
      }
    },
    {
      $lookup: {
        from: "orders",
        localField: "order",
        foreignField: "_id",
        as: "orderData"
      }
    },
    { $unwind: "$orderData" },
    {
      $match: {
        "orderData.status": { $nin: ["Cancelled", "Rejected", "Returned"] }
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productData"
      }
    },
    { $unwind: { path: "$productData", preserveNullAndEmptyArrays: true } },
    {
      $facet: {
        dailyMetrics: [
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              sales: { $sum: "$total" },
              orders: { $addToSet: "$order" }
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
        aggregateProfit: [
          {
            $project: {
              revenue: "$total",
              cost: {
                $multiply: [
                  { $ifNull: ["$productData.purchasePrice", { $multiply: ["$unitPrice", 0.7] }] }, // Default 70% cost if purchasePrice missing for estimation
                  "$quantity"
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$revenue" },
              totalCost: { $sum: "$cost" }
            }
          }
        ]
      }
    }
  ]);

  const dailyMetrics = detailedData[0]?.dailyMetrics || [];
  const profitStats = detailedData[0]?.aggregateProfit[0] || { totalRevenue: 0, totalCost: 0 };
  const totalProfit = profitStats.totalRevenue - profitStats.totalCost;

  // Prepare Daily Data Map for all days in range
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dailyMap = new Map();
  dailyMetrics.forEach((m: any) => dailyMap.set(m._id, m));

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
      totalProfit: totalProfit > 0 ? totalProfit : 0,
      totalLoss: totalProfit < 0 ? Math.abs(totalProfit) : 0,
      netProfit: totalProfit > 0 ? totalProfit : 0
    },
    dailySales: dailyData,
  };
};
