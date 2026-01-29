import Customer from "../models/Customer";
import Category from "../models/Category";
import SubCategory from "../models/SubCategory";
import Product from "../models/Product";
import Order from "../models/Order";
// import OrderItem from "../models/OrderItem";
// import Seller from "../models/Seller";

export interface DashboardStats {
  totalUser: number;
  totalCategory: number;
  totalSubcategory: number;
  totalProduct: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  soldOutProducts: number;
  lowStockProducts: number;
  totalRevenue: number;
  avgCompletedOrderValue: number;
}

export interface SalesData {
  date: string;
  value: number;
}

export interface TopSeller {
  sellerId: string;
  sellerName: string;
  storeName: string;
  totalRevenue: number;
  totalOrders: number;
}

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const [
      totalUser,
      totalCategory,
      totalSubcategory,
      totalProduct,
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      soldOutProducts,
      lowStockProducts,
      revenueData,
      avgOrderValue,
    ] = await Promise.all([
      Customer.countDocuments({ status: "Active" }).catch(() => 0),
      Category.countDocuments().catch(() => 0),
      SubCategory.countDocuments().catch((err) => {
        console.error("Error counting subcategories:", err);
        return 0;
      }),
      Product.countDocuments({ status: "Active" }).catch(() => 0),
      Order.countDocuments().catch(() => 0),
      Order.countDocuments({ status: "Delivered" }).catch(() => 0),
      Order.countDocuments({
        status: { $in: ["Received", "Pending", "Processed"] },
      }).catch(() => 0),
      Order.countDocuments({ status: "Cancelled" }).catch(() => 0),
      Product.countDocuments({ stock: 0, status: "Active" }).catch(() => 0),
      Product.countDocuments({ stock: { $lte: 10, $gt: 0 }, status: "Active" }).catch(() => 0),
      Order.aggregate([
        { $match: { status: "Delivered", paymentStatus: "Paid" } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$total", 0] } } } },
      ]).catch(() => []),
      Order.aggregate([
        { $match: { status: "Delivered", paymentStatus: "Paid" } },
        { $group: { _id: null, avg: { $avg: { $ifNull: ["$total", 0] } } } },
      ]).catch(() => []),
    ]);

    const totalRevenue = revenueData[0]?.total || 0;
    const avgCompletedOrderValue = avgOrderValue[0]?.avg || 0;

    return {
      totalUser: totalUser || 0,
      totalCategory: totalCategory || 0,
      totalSubcategory: totalSubcategory || 0,
      totalProduct: totalProduct || 0,
      totalOrders: totalOrders || 0,
      completedOrders: completedOrders || 0,
      pendingOrders: pendingOrders || 0,
      cancelledOrders: cancelledOrders || 0,
      soldOutProducts: soldOutProducts || 0,
      lowStockProducts: lowStockProducts || 0,
      totalRevenue: totalRevenue || 0,
      avgCompletedOrderValue: Math.round((avgCompletedOrderValue || 0) * 100) / 100,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    // Return default values on error
    return {
      totalUser: 0,
      totalCategory: 0,
      totalSubcategory: 0,
      totalProduct: 0,
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      soldOutProducts: 0,
      lowStockProducts: 0,
      totalRevenue: 0,
      avgCompletedOrderValue: 0,
    };
  }
};

/**
 * Get sales analytics data for charts
 */
export const getSalesAnalytics = async (
  period: "day" | "week" | "month" | "year" = "month"
): Promise<{ thisPeriod: SalesData[]; lastPeriod: SalesData[] }> => {
  try {
    const now = new Date();
  let startDate: Date;
  let lastPeriodStart: Date;
  let groupFormat: string;
  // let dateFormat: string;

  switch (period) {
    case "day":
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 7
      );
      lastPeriodStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 14
      );
      groupFormat = "%Y-%m-%d";
      // dateFormat = "DD-MMM";
      break;
    case "week":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      lastPeriodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      groupFormat = "%Y-%U";
      // dateFormat = "Week %U";
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      lastPeriodStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      groupFormat = "%Y-%m";
      // dateFormat = "%B";
      break;
    case "year":
      startDate = new Date(now.getFullYear() - 4, 0, 1);
      lastPeriodStart = new Date(now.getFullYear() - 9, 0, 1);
      groupFormat = "%Y";
      // dateFormat = "%Y";
      break;
  }

  const [thisPeriodData, lastPeriodData] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          status: "Delivered",
          paymentStatus: "Paid",
          orderDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$orderDate" } },
          total: { $sum: { $ifNull: ["$total", 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]).catch(() => []),
    Order.aggregate([
      {
        $match: {
          status: "Delivered",
          paymentStatus: "Paid",
          orderDate: { $gte: lastPeriodStart, $lt: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$orderDate" } },
          total: { $sum: { $ifNull: ["$total", 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]).catch(() => []),
  ]);

  const thisPeriod = (thisPeriodData || []).map((item) => ({
    date: item._id || "",
    value: item.total || 0,
  }));

  const lastPeriod = (lastPeriodData || []).map((item) => ({
    date: item._id || "",
    value: item.total || 0,
  }));

    return { thisPeriod, lastPeriod };
  } catch (error) {
    console.error("Error fetching sales analytics:", error);
    return { thisPeriod: [], lastPeriod: [] };
  }
};

/**
 * Get order analytics (order counts by period)
 */
export const getOrderAnalytics = async (
  period: "day" | "month" = "month"
): Promise<{ thisPeriod: SalesData[]; lastPeriod: SalesData[] }> => {
  try {
    const now = new Date();
    let startDate: Date;
    let lastPeriodStart: Date;

    if (period === "day") {
      // Current month's daily data
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      lastPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    } else {
      // Yearly monthly data
      startDate = new Date(now.getFullYear(), 0, 1);
      lastPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
    }

    // Get all orders for the period
    const [thisPeriodOrders, lastPeriodOrders] = await Promise.all([
      Order.find({
        orderDate: { $gte: startDate },
      })
        .select("orderDate")
        .lean()
        .catch(() => []),
      Order.find({
        orderDate: { $gte: lastPeriodStart, $lt: startDate },
      })
        .select("orderDate")
        .lean()
        .catch(() => []),
    ]);

    let thisPeriod: SalesData[] = [];
    let lastPeriod: SalesData[] = [];

    if (period === "day") {
      // Daily data for current month
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentMonthName = monthNames[now.getMonth()];
      const lastMonthName = monthNames[(now.getMonth() - 1 + 12) % 12];

      // Count orders by day for current month
      const currentMonthCounts: { [key: number]: number } = {};
      thisPeriodOrders.forEach((order: any) => {
        const orderDate = new Date(order.orderDate);
        if (orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear()) {
          const day = orderDate.getDate();
          currentMonthCounts[day] = (currentMonthCounts[day] || 0) + 1;
        }
      });

      // Fill current month
      thisPeriod = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        return {
          date: `${String(day).padStart(2, "0")}-${currentMonthName}`,
          value: currentMonthCounts[day] || 0,
        };
      });

      // Count orders by day for last month
      const lastMonthCounts: { [key: number]: number } = {};
      lastPeriodOrders.forEach((order: any) => {
        const orderDate = new Date(order.orderDate);
        const lastMonth = (now.getMonth() - 1 + 12) % 12;
        const lastMonthYear = lastMonth === 11 ? now.getFullYear() - 1 : now.getFullYear();
        if (orderDate.getMonth() === lastMonth && orderDate.getFullYear() === lastMonthYear) {
          const day = orderDate.getDate();
          lastMonthCounts[day] = (lastMonthCounts[day] || 0) + 1;
        }
      });

      // Fill last month
      lastPeriod = Array.from({ length: daysLastMonth }, (_, i) => {
        const day = i + 1;
        return {
          date: `${String(day).padStart(2, "0")}-${lastMonthName}`,
          value: lastMonthCounts[day] || 0,
        };
      });
    } else {
      // Monthly data for current year
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

      // Count orders by month for current year
      const currentYearCounts: { [key: number]: number } = {};
      thisPeriodOrders.forEach((order: any) => {
        const orderDate = new Date(order.orderDate);
        if (orderDate.getFullYear() === now.getFullYear()) {
          const month = orderDate.getMonth();
          currentYearCounts[month] = (currentYearCounts[month] || 0) + 1;
        }
      });

      // Fill current year
      thisPeriod = monthNames.map((month, index) => ({
        date: month,
        value: currentYearCounts[index] || 0,
      }));

      // Count orders by month for last year
      const lastYearCounts: { [key: number]: number } = {};
      lastPeriodOrders.forEach((order: any) => {
        const orderDate = new Date(order.orderDate);
        if (orderDate.getFullYear() === now.getFullYear() - 1) {
          const month = orderDate.getMonth();
          lastYearCounts[month] = (lastYearCounts[month] || 0) + 1;
        }
      });

      // Fill last year
      lastPeriod = monthNames.map((month, index) => ({
        date: month,
        value: lastYearCounts[index] || 0,
      }));
    }

    return { thisPeriod, lastPeriod };
  } catch (error) {
    console.error("Error fetching order analytics:", error);
    return { thisPeriod: [], lastPeriod: [] };
  }
};

/**
 * Get today's sales total and comparison with last week same day
 */
export const getTodaySales = async (): Promise<{ salesToday: number; salesLastWeekSameDay: number }> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const lastWeekSameDay = new Date(today);
    lastWeekSameDay.setDate(lastWeekSameDay.getDate() - 7);
    const lastWeekNextDay = new Date(lastWeekSameDay);
    lastWeekNextDay.setDate(lastWeekNextDay.getDate() + 1);

    // Get ALL orders booked today (any status)
    const todayOrders = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$total", 0] } }
        }
      }
    ]).catch(() => []);

    // Get orders from same day last week
    const lastWeekOrders = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: lastWeekSameDay, $lt: lastWeekNextDay }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$total", 0] } }
        }
      }
    ]).catch(() => []);

    return {
      salesToday: todayOrders[0]?.total || 0,
      salesLastWeekSameDay: lastWeekOrders[0]?.total || 0
    };
  } catch (error) {
    console.error("Error fetching today's sales:", error);
    return {
      salesToday: 0,
      salesLastWeekSameDay: 0
    };
  }
};

/**
 * Get top sellers by revenue
 */
export const getTopSellers = async (
  limit: number = 10
): Promise<TopSeller[]> => {
  try {
    const topSellers = await Order.aggregate([
      {
        $match: {
          status: "Delivered",
          paymentStatus: "Paid",
        },
      },
      {
        $unwind: "$items",
      },
      {
        $lookup: {
          from: "orderitems",
          localField: "items",
          foreignField: "_id",
          as: "orderItem",
        },
      },
      {
        $unwind: {
          path: "$orderItem",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: {
            seller: "$orderItem.seller",
            orderId: "$_id",
          },
          totalRevenue: { $sum: "$orderItem.total" },
        },
      },
      {
        $group: {
          _id: "$_id.seller",
          totalRevenue: { $sum: "$totalRevenue" },
          totalOrders: { $sum: 1 },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: "sellers",
          localField: "_id",
          foreignField: "_id",
          as: "seller",
        },
      },
      {
        $unwind: {
          path: "$seller",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          sellerId: { $toString: "$_id" },
          sellerName: "$seller.sellerName",
          storeName: "$seller.storeName",
          totalRevenue: { $ifNull: ["$totalRevenue", 0] },
          totalOrders: { $ifNull: ["$totalOrders", 0] },
        },
      },
    ]);

    return topSellers || [];
  } catch (error) {
    console.error("Error fetching top sellers:", error);
    return [];
  }
};

/**
 * Get recent orders
 */
export const getRecentOrders = async (limit: number = 10) => {
  try {
    const orders = await Order.find()
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile")
      .sort({ orderDate: -1 })
      .limit(limit)
      .lean();

    return orders.map((order: any) => ({
      id: order._id.toString(),
      orderNumber: order.orderNumber || order._id.toString(),
      customerName: order.customerName || (order.customer?.name || "Unknown"),
      orderDate: order.orderDate || order.createdAt,
      status: order.status || "Received",
      amount: order.total || 0,
      deliveryBoy: order.deliveryBoy
        ? {
          name: (order.deliveryBoy as any).name || "Unknown",
          mobile: (order.deliveryBoy as any).mobile || "",
        }
        : null,
    }));
  } catch (error) {
    console.error("Error fetching recent orders:", error);
    return [];
  }
};

/**
 * Get sales by location
 */
export const getSalesByLocation = async () => {
  try {
    const salesByLocation = await Order.aggregate([
      {
        $match: {
          status: "Delivered",
          paymentStatus: "Paid",
        },
      },
      {
        $group: {
          _id: "$deliveryAddress.city",
          amount: { $sum: { $ifNull: ["$total", 0] } },
        },
      },
      {
        $sort: { amount: -1 },
      },
      {
        $project: {
          location: { $ifNull: ["$_id", "Unknown"] },
          amount: { $ifNull: ["$amount", 0] },
        },
      },
    ]);

    return salesByLocation || [];
  } catch (error) {
    console.error("Error fetching sales by location:", error);
    return [];
  }
};

/**
 * Get sales summary for a given date range
 */
export const getSalesSummary = async (startDate: Date, endDate: Date): Promise<any> => {
  try {
    // Calculate previous period
    const duration = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime());
    const prevStartDate = new Date(prevEndDate.getTime() - duration);

    // Helper function to get summary stats for a date range
    const getStats = async (start: Date, end: Date) => {
      const data = await Order.aggregate([
        {
          $match: {
            orderDate: { $gte: start, $lte: end },
            status: { $nin: ["Cancelled", "Rejected", "Returned"] }, // Exclude cancelled orders from sales stats
          },
        },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalSales: { $sum: { $ifNull: ["$total", 0] } },
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
                        { $ifNull: ["$total", 0] },
                        0,
                      ],
                    },
                  },
                  creditAmount: {
                    $sum: {
                      $cond: [
                        { $eq: ["$paymentMethod", "CREDIT"] },
                        { $ifNull: ["$total", 0] },
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            // Only need accumulation for the main period for daily chart & profit
            // But we can reuse this function if we only want summary for prev period
          },
        },
      ]);
      return data[0]?.summary[0] || {
        totalSales: 0,
        totalOrders: 0,
        paidAmount: 0,
        creditAmount: 0,
      };
    };

    const currentStats = await getStats(startDate, endDate);
    const prevStats = await getStats(prevStartDate, prevEndDate);

    // Calculate percent changes
    const calculateChange = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prev) / prev) * 100);
    };

    // Get Daily Sales and Profit Data (Only for current period)
    const detailedData = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate, $lte: endDate },
          status: { $nin: ["Cancelled", "Rejected", "Returned"] },
        },
      },
      {
        $facet: {
          dailySales: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                sales: { $sum: { $ifNull: ["$total", 0] } },
                orders: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          profitData: [
            { $unwind: "$items" },
            {
              $lookup: {
                from: "orderitems",
                localField: "items",
                foreignField: "_id",
                as: "itemDetails"
              }
            },
            { $unwind: "$itemDetails" },
            {
              $lookup: {
                from: "products",
                localField: "itemDetails.product",
                foreignField: "_id",
                as: "productDetails"
              }
            },
            {
              $unwind: {
                path: "$productDetails",
                preserveNullAndEmptyArrays: true
              }
            },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: { $multiply: ["$itemDetails.unitPrice", "$itemDetails.quantity"] } },
                // Use purchasePrice if available, otherwise fallback to 0 (assuming strictly profit calculation needs cost)
                // Or user might want: if purchasePrice missing, assume purchasePrice = 0? Or assume purchasePrice = unitPrice (0 profit)?
                // Let's assume purchasePrice = 0 if missing means 100% profit? No, usually typical ecommerce logic is if cost unknown, profit is accounting issue.
                // Let's stick to previous logic: fallback to unitPrice means 0 profit for that item.
                totalCost: {
                  $sum: {
                    $multiply: [
                      { $ifNull: ["$productDetails.purchasePrice", "$itemDetails.unitPrice"] },
                      "$itemDetails.quantity"
                    ]
                  }
                }
              }
            }
          ]
        },
      },
    ]);

    const profitInfo = detailedData[0]?.profitData[0] || { totalRevenue: 0, totalCost: 0 };
    const totalProfit = profitInfo.totalRevenue - profitInfo.totalCost;

    // Daily Data Filling
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
  } catch (error) {
    console.error("Error fetching sales summary:", error);
    throw error;
  }
};
