import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Seller from "../../../models/Seller";

/**
 * Get all sellers (for dropdowns/lists)
 */
export const getAllSellers = asyncHandler(async (_req: Request, res: Response) => {
    const sellers = await Seller.find({})
        .select("sellerName storeName profile status isEnabled mobile email balance commission categories logo")
        .sort({ storeName: 1 });

    return res.status(200).json({
        success: true,
        message: "Sellers fetched successfully",
        data: sellers,
    });
});

/**
 * Toggle seller enabled status
 */
export const toggleSellerEnabled = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isEnabled } = req.body;

    const seller = await Seller.findByIdAndUpdate(
        id,
        { isEnabled },
        { new: true, runValidators: true }
    );

    if (!seller) {
        return res.status(404).json({
            success: false,
            message: "Seller not found",
        });
    }

    return res.status(200).json({
        success: true,
        message: `Seller ${isEnabled ? 'enabled' : 'disabled'} successfully`,
        data: seller,
    });
});
