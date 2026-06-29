import { Request, Response } from "express";
import mongoose from "mongoose";
import OrderItem from "../../../models/OrderItem";
import Order from "../../../models/Order";
import Return from "../../../models/Return";
import SellerPurchaseEntry from "../../../models/SellerPurchaseEntry";
import { asyncHandler } from "../../../utils/asyncHandler";

// Helper to escape regex special characters
const escapeRegex = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parseQuotationRowId = (
    rowId: string
): { entryId: string; itemIndex: number } | null => {
    const lastDash = rowId.lastIndexOf("-");
    if (lastDash <= 0) return null;

    const itemIndex = Number(rowId.slice(lastDash + 1));
    if (!Number.isInteger(itemIndex) || itemIndex < 0) return null;

    const entryId = rowId.slice(0, lastDash);
    return entryId ? { entryId, itemIndex } : null;
};

const deleteSellerQuotationRow = async (
    rowId: string,
    sellerId: mongoose.Types.ObjectId
): Promise<boolean> => {
    const parsed = parseQuotationRowId(rowId);
    if (!parsed) return false;

    const entryQuery: any = { seller: sellerId, type: "quotation" };
    if (mongoose.Types.ObjectId.isValid(parsed.entryId)) {
        entryQuery.$or = [{ entryId: parsed.entryId }, { _id: parsed.entryId }];
    } else {
        entryQuery.entryId = parsed.entryId;
    }

    const entry = await SellerPurchaseEntry.findOne(entryQuery);
    if (!entry) return false;

    const items = Array.isArray(entry.data?.items) ? [...entry.data.items] : [];
    if (parsed.itemIndex >= items.length) return false;

    items.splice(parsed.itemIndex, 1);

    if (items.length === 0) {
        await SellerPurchaseEntry.findByIdAndDelete(entry._id);
    } else {
        entry.data = { ...(entry.data || {}), items };
        entry.markModified("data");
        await entry.save();
    }

    return true;
};

const deleteSellerOrderItemRow = async (
    orderItemId: string,
    sellerId: mongoose.Types.ObjectId,
    posOrderIds: mongoose.Types.ObjectId[]
): Promise<boolean> => {
    if (!mongoose.Types.ObjectId.isValid(orderItemId)) return false;

    const orderItem = await OrderItem.findById(orderItemId);
    if (!orderItem) return false;

    const belongsToSeller =
        orderItem.seller?.toString() === sellerId.toString() ||
        posOrderIds.some((orderId) => orderId.toString() === orderItem.order?.toString());

    if (!belongsToSeller) {
        throw new Error("Order item does not belong to this seller");
    }

    const order = await Order.findById(orderItem.order);
    if (!order) {
        await OrderItem.findByIdAndDelete(orderItemId);
        return true;
    }

    const remainingItemIds = order.items.filter(
        (itemId) => itemId.toString() !== orderItemId
    );

    if (remainingItemIds.length === 0) {
        await OrderItem.deleteMany({ order: order._id });
        await Order.findByIdAndDelete(order._id);
        return true;
    }

    await OrderItem.findByIdAndDelete(orderItemId);

    const remainingItems = await OrderItem.find({ _id: { $in: remainingItemIds } });
    const subtotal = remainingItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const tax = remainingItems.reduce((sum, item) => sum + (item.gstAmount || 0), 0);

    order.items = remainingItemIds as mongoose.Types.ObjectId[];
    order.subtotal = subtotal;
    order.tax = tax;
    order.total = Math.max(
        subtotal + (order.shipping || 0) + (order.platformFee || 0) - (order.discount || 0),
        0
    );
    await order.save();

    return true;
};

/**
 * Get seller's sales report with filters, sorting, and pagination
 */
export const getSalesReport = asyncHandler(
    async (req: Request, res: Response) => {
        const sellerId = (req as any).user.userId;
        const {
            fromDate,
            toDate,
            search,
            page = "1",
            limit = "10",
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        // Build query - filter by authenticated seller
        const query: any = { seller: new mongoose.Types.ObjectId(sellerId) };

        // Date range filter - Improved to handle empty strings or invalid dates
        if ((fromDate && fromDate !== '') || (toDate && toDate !== '')) {
            query.createdAt = {};
            if (fromDate && fromDate !== '') {
                const startDate = new Date(fromDate as string);
                if (!isNaN(startDate.getTime())) {
                    query.createdAt.$gte = startDate;
                }
            }
            if (toDate && toDate !== '') {
                const endDate = new Date(toDate as string);
                if (!isNaN(endDate.getTime())) {
                    // Set to end of day
                    endDate.setHours(23, 59, 59, 999);
                    query.createdAt.$lte = endDate;
                }
            }

            // If query.createdAt is still empty, remove it
            if (Object.keys(query.createdAt).length === 0) {
                delete query.createdAt;
            }
        }

        // Search filter
        if (search) {
            const escapedSearch = escapeRegex(search as string);
            // Find orders that match the search term (orderNumber)
            const matchedOrders = await Order.find({
                orderNumber: { $regex: escapedSearch, $options: "i" }
            }).select("_id");

            const matchedOrderIds = matchedOrders.map((o: any) => o._id);

            query.$or = [
                { productName: { $regex: escapedSearch, $options: "i" } },
                { variation: { $regex: escapedSearch, $options: "i" } },
                { order: { $in: matchedOrderIds } }
            ];
        }

        // Pagination
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Sort mappings (frontend names to backend names)
        const sortMap: Record<string, string> = {
            'orderId': 'order',
            'orderItemId': '_id',
            'product': 'productName',
            'variant': 'variation',
            'total': 'total',
            'date': 'createdAt'
        };

        const backendSortBy = sortMap[sortBy as string] || sortBy as string;

        // Sort
        const sort: any = {};
        sort[backendSortBy] = sortOrder === "asc" ? 1 : -1;

        // Get order items with populated order info
        const orderItems = await OrderItem.find(query)
            .populate({
                path: "order",
                select: "orderNumber createdAt"
            })
            .sort(sort)
            .skip(skip)
            .limit(limitNum);

        // Get total count for pagination
        const total = await OrderItem.countDocuments(query);

        // Format response for frontend
        const reports = orderItems.map(item => ({
            orderId: (item.order as any)?.orderNumber || '',
            dbOrderId: (item.order as any)?._id || '', // Added for linking
            orderItemId: item._id.toString().slice(-6).toUpperCase(), // Item ID shortcut
            product: item.productName,
            variant: item.variation || 'N/A',
            total: item.total,
            date: item.createdAt.toISOString().replace('T', ' ').split('.')[0], // YYYY-MM-DD HH:mm:ss
        }));

        return res.status(200).json({
            success: true,
            message: "Sales report fetched successfully",
            data: reports,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
);

/**
 * Get Seller GST Sales Report
 */
export const getGSTSalesReport = asyncHandler(
    async (req: Request, res: Response) => {
        const sellerId = (req as any).user.userId;
        const {
            page = 1,
            limit = 20,
            search,
            dateFrom,
            dateTo,
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const searchRegex = search ? new RegExp(escapeRegex(search as string), "i") : null;
        const normalizeDate = (value: any) => {
            if (!value) return "";
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
        };
        const isWithinRange = (dateValue: string, from?: string, to?: string) => {
            if ((!from && !to) || !dateValue) return true;
            const ts = new Date(dateValue).getTime();
            if (Number.isNaN(ts)) return true;
            if (from) {
                const fromTs = new Date(from as string).getTime();
                if (!Number.isNaN(fromTs) && ts < fromTs) return false;
            }
            if (to) {
                const toDate = new Date(to as string);
                if (!Number.isNaN(toDate.getTime())) {
                    toDate.setHours(23, 59, 59, 999);
                    if (ts > toDate.getTime()) return false;
                }
            }
            return true;
        };
        const buildQuotationRows = (entries: any[]) => {
            return entries.flatMap((entry) => {
                const entryData = entry.data || {};
                const items = Array.isArray(entryData.items) ? entryData.items : [];
                const quoteDate = normalizeDate(entryData.date || entry.date || entry.createdAt);
                const invoiceNo = `QTN-${String(entry.entryId || entryData.id || entry._id).slice(-8).toUpperCase()}`;
                const customerName =
                    entryData.customer?.name ||
                    entryData.customerName ||
                    entryData.supplier?.name ||
                    "Quotation";

                return items.map((item: any, index: number) => {
                    const quantity = Number(item.qty ?? item.quantity ?? 0);
                    const unitPrice = Number(item.purchasePrice ?? item.unitPrice ?? item.price ?? 0);
                    const gross = unitPrice * quantity;
                    const discount =
                        item.billDiscountType === "%"
                            ? (gross * Number(item.billDiscount ?? 0)) / 100
                            : Number(item.billDiscount ?? 0);
                    const netBeforeTax = Math.max(gross - discount, 0);
                    const rate = Number(item.gstPercent ?? item.gst ?? item.taxPercentage ?? 0);
                    const inclusive = item.includingGST !== false;
                    const taxAmount = rate > 0
                        ? inclusive
                            ? Number(((netBeforeTax * rate) / (100 + rate)).toFixed(2))
                            : Number(((netBeforeTax * rate) / 100).toFixed(2))
                        : 0;
                    const taxableAmount = inclusive ? Number((netBeforeTax - taxAmount).toFixed(2)) : netBeforeTax;
                    const totalAmount = Number((taxableAmount + taxAmount).toFixed(2));

                    return {
                        _id: `${entry.entryId || entry._id}-${index}`,
                        type: "quotation",
                        date: quoteDate,
                        invoiceNo,
                        customerName,
                        productName: item.productName || "Quotation Item",
                        hsn: item.hsnCode || item.hsn || "N/A",
                        quantity,
                        stock: 0,
                        price: unitPrice,
                        taxableAmount,
                        taxPercentage: rate,
                        taxAmount,
                        totalAmount,
                    };
                });
            });
        };

        const sellerObjectId = new mongoose.Types.ObjectId(sellerId);

        // PRE-FETCH: get all POS order IDs for this seller using the adminNotes index.
        // This is far more efficient than starting the pipeline with a $lookup (full scan).
        const posOrders = await Order.find({
            adminNotes: { $regex: `POS Order - Seller: ${sellerId}`, $options: "i" }
        }).select("_id").lean();
        const posOrderIds = posOrders.map((o: any) => o._id);

        // Aggregation Pipeline
        const pipeline: any[] = [
            // 1. Match Seller Items — uses indexes on OrderItem.seller and OrderItem.order.
            //    Includes items directly assigned to this seller (online orders)
            //    AND all items in POS orders created by this seller (by order._id pre-fetch).
            {
                $match: {
                    $or: [
                        { seller: sellerObjectId },
                        { order: { $in: posOrderIds } }
                    ]
                }
            },

            // 2. Lookup Order Details
            {
                $lookup: {
                    from: "orders",
                    localField: "order",
                    foreignField: "_id",
                    as: "orderDoc"
                }
            },
            { $unwind: "$orderDoc" },

            // 3. Filter by Date (using Order Date)
            ...(dateFrom || dateTo ? [{
                $match: {
                    "orderDoc.orderDate": {
                        ...(dateFrom && { $gte: new Date(dateFrom as string) }),
                        ...(dateTo && { $lte: ((): Date => {
                            const d = new Date(dateTo as string);
                            d.setHours(23, 59, 59, 999);
                            return d;
                        })() })
                    }
                }
            }] : []),

            // 4. Lookup Product Details (for HSN)
            {
                $lookup: {
                    from: "products",
                    localField: "product",
                    foreignField: "_id",
                    as: "productDoc"
                }
            },
            { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },

            // 5. Lookup Tax Details
            {
                $lookup: {
                    from: "taxes",
                    localField: "productDoc.tax",
                    foreignField: "_id",
                    as: "taxDoc"
                }
            },
            { $unwind: { path: "$taxDoc", preserveNullAndEmptyArrays: true } },

            // 5b. Resolve HSN and GST once, falling back through:
            //       OrderItem.hsnCode   -> Product.hsnCode               -> "N/A"
            //       OrderItem.gst       -> Product.gst -> Tax.percentage -> 0
            //
            //     The original projection used plain `$ifNull`, which only
            //     catches null/missing. That left two real-world holes:
            //       - `OrderItem.hsnCode` defaults to "" (empty string) on the
            //         schema, so an empty value never reached the product
            //         fallback and the report rendered "" / "N/A" even when
            //         the product itself had a perfectly good HSN code.
            //       - `OrderItem.gst` could be persisted as `0` whenever the
            //         POS cart was built from a legacy product whose `gst`
            //         field hadn't been populated yet. `$ifNull` happily kept
            //         that `0`, so the GST column showed `0%` even after the
            //         product was updated. We also skipped Product.gst as a
            //         fallback source entirely (only Tax.percentage was
            //         considered).
            //
            //     Treating `0` as "unset" for GST means tax-exempt items will
            //     still cascade through Product/Tax — that's acceptable here
            //     because the only way to legitimately get 0% in this app is
            //     to set it explicitly on the Product (which is then the
            //     fallback anyway).
            {
                $addFields: {
                    _resolvedHsn: {
                        $let: {
                            vars: {
                                itemHsn: {
                                    $cond: [
                                        { $in: [{ $ifNull: ["$hsnCode", ""] }, [null, ""]] },
                                        null,
                                        "$hsnCode"
                                    ]
                                },
                                prodHsn: {
                                    $cond: [
                                        { $in: [{ $ifNull: ["$productDoc.hsnCode", ""] }, [null, ""]] },
                                        null,
                                        "$productDoc.hsnCode"
                                    ]
                                }
                            },
                            in: { $ifNull: ["$$itemHsn", { $ifNull: ["$$prodHsn", "N/A"] }] }
                        }
                    },
                    _resolvedGst: {
                        $let: {
                            vars: {
                                itemGst: { $ifNull: ["$gst", 0] },
                                prodGst: { $ifNull: ["$productDoc.gst", 0] },
                                taxGst: { $ifNull: ["$taxDoc.percentage", 0] }
                            },
                            in: {
                                $cond: [
                                    { $gt: ["$$itemGst", 0] },
                                    "$$itemGst",
                                    {
                                        $cond: [
                                            { $gt: ["$$prodGst", 0] },
                                            "$$prodGst",
                                            "$$taxGst"
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            // 6. Project Required Fields
            {
                $project: {
                    _id: 1,
                    type: "order",
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$orderDoc.orderDate" } },
                    invoiceNo: "$orderDoc.orderNumber",
                    customerName: "$orderDoc.customerName",
                    gstin: { $ifNull: ["$orderDoc.deliveryAddress.gstin", "N/A"] }, // Adjust if GSTIN is stored elsewhere
                    productName: "$productName",
                    hsn: "$_resolvedHsn",
                    quantity: "$quantity",
                    stock: { $ifNull: ["$productDoc.stock", 0] }, // Current stock of the product
                    price: "$unitPrice", // Selling Price
                    taxPercentage: "$_resolvedGst",
                    taxableAmount: {
                        $cond: [
                            { $gt: ["$_resolvedGst", 0] },
                            { $divide: ["$total", { $add: [1, { $divide: ["$_resolvedGst", 100] }] }] },
                            "$total"
                        ]
                    },
                    taxAmount: {
                        $ifNull: [
                            "$gstAmount",
                            {
                                $cond: [
                                    { $gt: ["$_resolvedGst", 0] },
                                    {
                                        $divide: [
                                            { $multiply: ["$total", "$_resolvedGst"] },
                                            { $add: [100, "$_resolvedGst"] }
                                        ]
                                    },
                                    0
                                ]
                            }
                        ]
                    },
                    totalAmount: "$total"
                }
            },

            // 7. Search Filter
            ...(searchRegex ? [
                {
                    $match: {
                        $or: [
                            { invoiceNo: searchRegex },
                            { customerName: searchRegex },
                            { productName: searchRegex }
                        ]
                    }
                }
            ] : []),

            // Sort is applied in JS after merging quotation rows (see below).
        ];

        const results = await OrderItem.aggregate(pipeline).allowDiskUse(true);
        const orderRows = results || [];
        const quotationEntries = await SellerPurchaseEntry.find({
            seller: new mongoose.Types.ObjectId(sellerId),
            type: "quotation",
        }).lean();
        const quotationRows = buildQuotationRows(quotationEntries).filter((row) => {
            if (!isWithinRange(row.date, dateFrom as string | undefined, dateTo as string | undefined)) {
                return false;
            }
            if (!searchRegex) return true;
            return searchRegex.test(row.invoiceNo) || searchRegex.test(row.customerName) || searchRegex.test(row.productName);
        });

        const data = [...orderRows, ...quotationRows].sort((a, b) => {
            const dateDiff = String(b.date || "").localeCompare(String(a.date || ""));
            if (dateDiff !== 0) return dateDiff;
            return String(b.invoiceNo || "").localeCompare(String(a.invoiceNo || ""));
        });
        const combinedTotal = data.length;
        const paginatedData = data.slice(skip, skip + limitNum);

        return res.status(200).json({
            success: true,
            message: "GST Sales report fetched successfully",
            data: paginatedData,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: combinedTotal,
                pages: Math.ceil(combinedTotal / limitNum),
            },
        });
    }
);

export const deleteGSTSalesReportEntries = asyncHandler(
    async (req: Request, res: Response) => {
        const sellerId = new mongoose.Types.ObjectId((req as any).user.userId);
        const { ids } = req.body as { ids?: string[] };

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "ids array is required",
            });
        }

        const posOrders = await Order.find({
            adminNotes: { $regex: `POS Order - Seller: ${sellerId.toString()}`, $options: "i" },
        })
            .select("_id")
            .lean();
        const posOrderIds = posOrders.map((order: any) => order._id);

        const failed: { id: string; message: string }[] = [];
        let deletedCount = 0;

        for (const rawId of ids) {
            const id = String(rawId);
            try {
                let deleted = false;

                if (parseQuotationRowId(id)) {
                    deleted = await deleteSellerQuotationRow(id, sellerId);
                } else if (mongoose.Types.ObjectId.isValid(id)) {
                    deleted = await deleteSellerOrderItemRow(id, sellerId, posOrderIds);
                }

                if (deleted) {
                    deletedCount += 1;
                } else {
                    failed.push({ id, message: "Record not found" });
                }
            } catch (error: any) {
                failed.push({ id, message: error?.message || "Delete failed" });
            }
        }

        return res.status(200).json({
            success: failed.length === 0,
            message:
                failed.length === 0
                    ? "Selected GST sales records deleted successfully"
                    : `Deleted ${deletedCount} record(s); ${failed.length} failed`,
            deletedCount,
            failed,
        });
    }
);

/**
 * Get Seller Payment Report
 */
export const getPaymentReport = asyncHandler(
    async (req: Request, res: Response) => {
        const sellerId = (req as any).user.userId;
        const {
            page = 1,
            limit = 20,
            search,
            dateFrom,
            dateTo,
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const searchRegex = search ? new RegExp(escapeRegex(search as string), "i") : null;

        // Base match for OrderItems
        const matchQuery: any = {
            seller: new mongoose.Types.ObjectId(sellerId)
        };

        const pipeline: any[] = [
            { $match: matchQuery },

            // Group by Order to get total per order for this seller
            {
                $group: {
                    _id: "$order",
                    sellerTotal: { $sum: "$total" }
                }
            },

            // Lookup Order Details
            {
                $lookup: {
                    from: "orders",
                    localField: "_id",
                    foreignField: "_id",
                    as: "orderDoc"
                }
            },
            { $unwind: "$orderDoc" },

            // Match Date
            ...(dateFrom || dateTo ? [{
                $match: {
                    "orderDoc.orderDate": {
                        ...(dateFrom && { $gte: new Date(dateFrom as string) }),
                        ...(dateTo && { $lte: new Date(dateTo as string) })
                    }
                }
            }] : []),

            // Determine Type (POS/Online)
            {
                $addFields: {
                    type: {
                        $cond: {
                            if: {
                                $or: [
                                    { $regexMatch: { input: { $ifNull: ["$orderDoc.adminNotes", ""] }, regex: "pos", options: "i" } },
                                    { $eq: ["$orderDoc.deliveryAddress.address", "POS Order"] }
                                ]
                            },
                            then: "POS",
                            else: "Online"
                        }
                    }
                }
            },

            // Project Fields
            {
                $project: {
                    _id: 1,
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$orderDoc.orderDate" } },
                    paymentId: { $ifNull: ["$orderDoc.paymentId", "N/A"] },
                    orderNumber: "$orderDoc.orderNumber",
                    customerName: "$orderDoc.customerName",
                    amount: "$sellerTotal", // Showing Seller's Share
                    paymentMethod: "$orderDoc.paymentMethod",
                    status: "$orderDoc.paymentStatus",
                    type: 1
                }
            },

            // Search Filter
            ...(searchRegex ? [
                {
                    $match: {
                        $or: [
                            { orderNumber: searchRegex },
                            { paymentId: searchRegex },
                            { customerName: searchRegex }
                        ]
                    }
                }
            ] : []),

            // Sort
            { $sort: { date: -1, orderNumber: -1 } },

            // Pagination
            {
                $facet: {
                    data: [
                        { $skip: skip },
                        { $limit: limitNum }
                    ],
                    totalCount: [
                        { $count: "count" }
                    ]
                }
            }
        ];

        const results = await OrderItem.aggregate(pipeline);
        const data = results[0].data;
        const total = results[0].totalCount[0]?.count || 0;

        return res.status(200).json({
            success: true,
            message: "Payment report fetched successfully",
            data,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
);

/**
 * Get Sales Summary Report
 */
export const getSalesSummaryReport = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    const searchRegex = search ? new RegExp(escapeRegex(search as string), "i") : null;

    const matchQuery: any = {
      seller: new mongoose.Types.ObjectId(sellerId)
    };

    // Date filter on OrderItems creation date (assuming it matches order date)
    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) {
        const dFrom = new Date(dateFrom as string);
        if (!isNaN(dFrom.getTime())) matchQuery.createdAt.$gte = dFrom;
      }
      if (dateTo) {
        const dTo = new Date(dateTo as string);
        dTo.setHours(23, 59, 59, 999);
        if (!isNaN(dTo.getTime())) matchQuery.createdAt.$lte = dTo;
      }
      if (Object.keys(matchQuery.createdAt).length === 0) delete matchQuery.createdAt;
    }

    const pipeline: any[] = [
      { $match: matchQuery },

      // Lookup Order to get Invoice No, Customer, Payment Mode, Status
      {
        $lookup: {
          from: "orders",
          localField: "order",
          foreignField: "_id",
          as: "orderDoc"
        }
      },
      { $unwind: "$orderDoc" },

      // Lookup Product for details if needed (Purchase Price)
      {
          $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "productDoc"
          }
      },
      { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },

      // Calculate Seller specific values
      {
        $project: {
          orderId: "$order",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$orderDoc.orderDate", onNull: "N/A" } },
          time: { $dateToString: { format: "%H:%M", date: "$orderDoc.orderDate", onNull: "N/A" } },
          invoiceNo: "$orderDoc.orderNumber",
          customerName: "$orderDoc.customerName",
          paymentMode: "$orderDoc.paymentMethod",
          status: "$orderDoc.status",

          // Item metrics
          quantity: "$quantity",
          unitPrice: "$unitPrice", // Selling Price
          total: "$total", // Item Total (SP * Qty)

          // Costs/MRP
          mrp: { $ifNull: ["$productDoc.compareAtPrice", "$unitPrice"] },
          purchasePrice: { $ifNull: ["$productDoc.purchasePrice", 0] },

          // Mode
          mode: {
             $cond: {
               if: {
                 $or: [
                   { $regexMatch: { input: { $ifNull: ["$orderDoc.adminNotes", ""] }, regex: "pos", options: "i" } },
                   { $eq: ["$orderDoc.deliveryAddress.address", "POS Order"] }
                 ]
               },
               then: "POS",
               else: "Retail"
             }
           }
        }
      },

      // Group by Order to summarize for this seller
      {
        $group: {
          _id: "$orderId",
          date: { $first: "$date" },
          time: { $first: "$time" },
          invoiceNo: { $first: "$invoiceNo" },
          customerName: { $first: "$customerName" },
          paymentMode: { $first: "$paymentMode" },
          status: { $first: "$status" },
          mode: { $first: "$mode" },

          noOfItems: { $sum: 1 }, // Or sum quantity? Let's count line items or distinct products
          // If we want total quantity:
          // totalQuantity: { $sum: "$quantity" },

          total: { $sum: "$total" },

          totalMRP: { $sum: { $multiply: ["$mrp", "$quantity"] } },
          totalSP: { $sum: "$total" }, // Or sum(unitPrice * quantity)
          totalPurchase: { $sum: { $multiply: ["$purchasePrice", "$quantity"] } }
        }
      },

      // Calculate Derived Fields
      {
        $addFields: {
           totalDiscount: { $subtract: ["$totalMRP", "$totalSP"] },
           totalDiscountPercent: {
             $cond: {
               if: { $gt: ["$totalMRP", 0] },
               then: { $multiply: [{ $divide: [{ $subtract: ["$totalMRP", "$totalSP"] }, "$totalMRP"] }, 100] },
               else: 0
             }
           },
           profit: { $subtract: ["$totalSP", "$totalPurchase"] }
        }
      },

      // Search Filter
      ...(searchRegex ? [
        {
          $match: {
            $or: [
              { invoiceNo: searchRegex },
              { customerName: searchRegex }
            ]
          }
        }
      ] : []),

      { $sort: { date: -1, invoiceNo: -1 } },

      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const results = await OrderItem.aggregate(pipeline);
    const data = results[0]?.data || [];
    const total = results[0]?.totalCount?.[0]?.count || 0;

    return res.status(200).json({
      success: true,
      message: "Sales summary report fetched successfully",
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Get Return and Exchange Report
 */
export const getReturnExchangeReport = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    const searchRegex = search ? new RegExp(escapeRegex(search as string), "i") : null;

    const matchQuery: any = {};
    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) {
         const dFrom = new Date(dateFrom as string);
         if (!isNaN(dFrom.getTime())) matchQuery.createdAt.$gte = dFrom;
      }
      if (dateTo) {
         const dTo = new Date(dateTo as string);
         if (dTo.toISOString().length <= 10) dTo.setHours(23, 59, 59, 999);
         if (!isNaN(dTo.getTime())) matchQuery.createdAt.$lte = dTo;
      }
      if (Object.keys(matchQuery.createdAt).length === 0) delete matchQuery.createdAt;
    }

    // Use imported Return model

    const pipeline: any[] = [
      { $match: matchQuery },

      // Lookup OrderItem to check Seller
      {
        $lookup: {
          from: "orderitems",
          localField: "orderItem",
          foreignField: "_id",
          as: "itemDoc"
        }
      },
      { $unwind: "$itemDoc" },

      // Filter by Seller
      {
         $match: {
            "itemDoc.seller": new mongoose.Types.ObjectId(sellerId)
         }
      },

      // Lookup Order
      {
        $lookup: {
          from: "orders",
          localField: "order",
          foreignField: "_id",
          as: "orderDoc"
        }
      },
      { $unwind: { path: "$orderDoc", preserveNullAndEmptyArrays: true } },

      // Lookup Customer
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customerDoc"
        }
      },
      { $unwind: { path: "$customerDoc", preserveNullAndEmptyArrays: true } },

      // Lookup Product
      {
         $lookup: {
             from: "products",
             localField: "itemDoc.product",
             foreignField: "_id",
             as: "productDoc"
         }
      },
      { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          _id: 1,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", onNull: "N/A" } },
          saleReturnNo: { $toString: "$_id" },
          invoiceNo: { $ifNull: ["$orderDoc.orderNumber", "N/A"] },
          customerName: { $ifNull: ["$customerDoc.name", "N/A"] },
          paymentMode: { $ifNull: ["$orderDoc.paymentMethod", "N/A"] },
          noOfItems: { $ifNull: ["$quantity", 0] },

          unitPrice: { $ifNull: ["$itemDoc.unitPrice", 0] },
          mrp: { $ifNull: ["$productDoc.compareAtPrice", { $ifNull: ["$itemDoc.unitPrice", 0] }] },
          quantity: { $ifNull: ["$quantity", 0] },
          refundAmount: 1,

          billAmt: "$orderDoc.total", // This is total order amount, irrelevant for single item return? Only for reference.
          paidBy: { $ifNull: ["$orderDoc.paymentMethod", "N/A"] }
        }
      },
      {
        $addFields: {
          totalMRP: { $multiply: ["$mrp", "$quantity"] },
          totalSP: { $multiply: ["$unitPrice", "$quantity"] },
          saleAmt: { $multiply: ["$unitPrice", "$quantity"] },
        }
      },
      {
        $addFields: {
           totalDiscount: { $subtract: ["$totalMRP", "$totalSP"] },
           returnAmt: { $ifNull: ["$refundAmount", "$totalSP"] }
        }
      },

      // Search
      ...(searchRegex ? [
        {
          $match: {
            $or: [
              { invoiceNo: searchRegex },
              { customerName: searchRegex },
              { saleReturnNo: searchRegex }
            ]
          }
        }
      ] : []),

      { $sort: { date: -1, invoiceNo: -1 } },

      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const results = await Return.aggregate(pipeline);
    const data = results[0]?.data || [];
    const total = results[0]?.totalCount?.[0]?.count || 0;

    return res.status(200).json({
      success: true,
      message: "Return exchange report fetched successfully",
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Get Stock Sales Summary Report
 */
export const getStockSalesSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const {
      page = 1,
      limit = 20,
      search,
      category,
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    const searchRegex = search ? new RegExp(escapeRegex(search as string), "i") : null;

    const matchQuery: any = {
      seller: new mongoose.Types.ObjectId(sellerId)
    };

    if (dateFrom || dateTo) {
      matchQuery.createdAt = {}; // Use OrderItem createdAt (~ Order Date)
      if (dateFrom) {
         const dFrom = new Date(dateFrom as string);
         if (!isNaN(dFrom.getTime())) matchQuery.createdAt.$gte = dFrom;
      }
      if (dateTo) {
         const dTo = new Date(dateTo as string);
         dTo.setHours(23, 59, 59, 999);
         if (!isNaN(dTo.getTime())) matchQuery.createdAt.$lte = dTo;
      }
      if (Object.keys(matchQuery.createdAt).length === 0) delete matchQuery.createdAt;
    }

    const pipeline: any[] = [
      { $match: matchQuery },

      // Lookup Product
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productDoc"
        }
      },
      { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },

      // Lookup Category
      {
        $lookup: {
          from: "categories",
          localField: "productDoc.category",
          foreignField: "_id",
          as: "categoryDoc"
        }
      },
      { $unwind: { path: "$categoryDoc", preserveNullAndEmptyArrays: true } },

      // Lookup Tax
      {
        $lookup: {
          from: "taxes",
          localField: "productDoc.tax",
          foreignField: "_id",
          as: "taxDoc"
        }
      },
      { $unwind: { path: "$taxDoc", preserveNullAndEmptyArrays: true } },

      // Category filter
      ...(category ? [
        { $match: { "categoryDoc.name": category } }
      ] : []),

      // Search filter
      ...(searchRegex ? [
         {
           $match: {
             $or: [
               { productName: searchRegex },
               { "categoryDoc.name": searchRegex },
               { "productDoc.hsnCode": searchRegex }
             ]
           }
         }
      ] : []),

      // Group
      {
        $group: {
          _id: {
            prodId: "$product",
            variant: "$variation"
          },
          itemName: { $first: "$productName" },
          variantName: { $first: { $ifNull: ["$variation", "Standard"] } },
          uom: { $first: { $ifNull: ["$productDoc.pack", "Piece"] } },
          hsn: { $first: { $ifNull: ["$productDoc.hsnCode", "N/A"] } },
          category: { $first: { $ifNull: ["$categoryDoc.name", "Uncategorized"] } },
          taxPercent: { $first: { $ifNull: ["$taxDoc.percentage", 0] } },

          unitsSold: { $sum: "$quantity" },
          purchasePrice: { $first: { $ifNull: ["$productDoc.purchasePrice", 0] } },
          averageSellingPrice: { $avg: "$unitPrice" },
          totalSellingPrice: { $sum: "$total" }
        }
      },

      // Computed
      {
        $addFields: {
           gst: { $concat: [{ $toString: "$taxPercent" }, "%"] },
           cess: "0%",
           profit: {
             $subtract: [
               "$totalSellingPrice",
               { $multiply: ["$unitsSold", "$purchasePrice"] }
             ]
           },
           sellingPrice: { $round: ["$averageSellingPrice", 2] }
        }
      },

      // Sort
      { $sort: { totalSellingPrice: -1 } },

      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const results = await OrderItem.aggregate(pipeline);
    const data = results[0]?.data || [];
    const total = results[0]?.totalCount?.[0]?.count || 0;

    return res.status(200).json({
      success: true,
      message: "Stock sales summary fetched successfully",
      data: data.map((item: any) => ({
           ...item,
           _id: `${item._id.prodId}_${item._id.variant || 'std'}`,
           salesman: "Seller"
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Get Due Summary Report
 */
export const getDueSummaryReport = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    const searchRegex = search ? new RegExp(escapeRegex(search as string), "i") : null;

    // Filter Items by Seller
    const matchQuery: any = {
      seller: new mongoose.Types.ObjectId(sellerId)
    };

    if (dateFrom || dateTo) {
       matchQuery.createdAt = {}; // Use OrderItem createdAt
       if (dateFrom) {
          const dFrom = new Date(dateFrom as string);
          if (!isNaN(dFrom.getTime())) matchQuery.createdAt.$gte = dFrom;
       }
       if (dateTo) {
          const dTo = new Date(dateTo as string);
          dTo.setHours(23, 59, 59, 999);
          if (!isNaN(dTo.getTime())) matchQuery.createdAt.$lte = dTo;
       }
       if (Object.keys(matchQuery.createdAt).length === 0) delete matchQuery.createdAt;
    }

    const pipeline: any[] = [
      { $match: matchQuery },

      // Lookup Order
      {
        $lookup: {
          from: "orders",
          localField: "order",
          foreignField: "_id",
          as: "orderDoc"
        }
      },
      { $unwind: "$orderDoc" },

      // Filter by Pending/Failed Payment
      {
         $match: {
           "orderDoc.paymentStatus": { $in: ["Pending", "Failed"] }
         }
      },

      // Group by Order (Since multiple items might belong to same order)
      {
        $group: {
          _id: "$order",
          date: { $first: { $dateToString: { format: "%Y-%m-%d", date: "$orderDoc.orderDate", onNull: "N/A" } } },
          orderNo: { $first: "$orderDoc.orderNumber" },
          customerName: { $first: "$orderDoc.customerName" },
          // customerPhone is not always in orderDoc root, sometimes in deliveryAddress.phone or customer lookup
          // Let's try finding it from orderDoc (it has deliveryAddress)
          customerPhone: { $first: { $ifNull: ["$orderDoc.deliveryAddress.phone", "N/A"] } },

          paymentMode: { $first: "$orderDoc.paymentMethod" },
          status: { $first: "$orderDoc.paymentStatus" },
          orderStatus: { $first: "$orderDoc.status" },

          // Sum only this seller's share
          total: { $sum: "$total" }
        }
      },

      {
        $addFields: {
          paid: 0, // Since it's pending/due
          due: "$total"
        }
      },

      // Search
      ...(searchRegex ? [
         {
           $match: {
             $or: [
               { orderNo: searchRegex },
               { customerName: searchRegex },
               { customerPhone: searchRegex }
             ]
           }
         }
      ] : []),

      { $sort: { date: -1 } },

      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const results = await OrderItem.aggregate(pipeline);
    const data = results[0]?.data || [];
    const total = results[0]?.totalCount?.[0]?.count || 0;

    return res.status(200).json({
      success: true,
      message: "Due summary report fetched successfully",
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);
