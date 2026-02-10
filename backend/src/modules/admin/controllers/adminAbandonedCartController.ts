import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Cart from "../../../models/Cart";

/**
 * Get all abandoned carts with filters
 */
export const getAbandonedCarts = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      search,
      startDate,
      endDate,
      minPrice,
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Filter carts that have items
    const query: any = {
      items: { $exists: true, $not: { $size: 0 } }
    };

    if (minPrice) {
        query.total = { $gte: parseFloat(minPrice as string) };
    }

    if (startDate || endDate) {
        query.updatedAt = {};
        if (startDate) query.updatedAt.$gte = new Date(startDate as string);
        if (endDate) {
            const end = new Date(endDate as string);
            end.setHours(23, 59, 59, 999);
            query.updatedAt.$lte = end;
        }
    }

    // Since we need to search by customer name/phone, we might need aggregation or separate customer fetch
    // But let's try a simpler approach if possible.
    // Actually, aggregation is better here because we need to join with Customer and filter.

    const pipeline: any[] = [
        { $match: query },
        {
            $lookup: {
                from: "customers",
                localField: "customer",
                foreignField: "_id",
                as: "customerInfo"
            }
        },
        { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } }
    ];

    if (search) {
        pipeline.push({
            $match: {
                $or: [
                    { "customerInfo.name": { $regex: search as string, $options: "i" } },
                    { "customerInfo.phone": { $regex: search as string, $options: "i" } },
                    { "customerInfo.email": { $regex: search as string, $options: "i" } }
                ]
            }
        });
    }

    // Pagination and sorting
    pipeline.push({ $sort: { updatedAt: -1 } });

    const totalPipeline = [...pipeline, { $count: "total" }];

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit as string) });

    // Populate items
    // This is tricky in aggregation, so we'll do it after fetching or use $lookup for items too

    const [results, totalResult] = await Promise.all([
        Cart.aggregate(pipeline),
        Cart.aggregate(totalPipeline)
    ]);

    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Manually populate items for each cart since aggregation lookup for nested populate is messy
    const carts = await Promise.all(results.map(async (cart) => {
        const fullCart = await Cart.findById(cart._id)
            .populate({
                path: 'items',
                populate: {
                    path: 'product',
                    select: 'productName mainImage price'
                }
            })
            .lean();

        return {
            ...fullCart,
            customer: cart.customerInfo
        };
    }));

    return res.status(200).json({
      success: true,
      data: carts,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);
