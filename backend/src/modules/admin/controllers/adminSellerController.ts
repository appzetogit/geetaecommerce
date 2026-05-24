import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Seller from "../../../models/Seller";
import { CLOUDINARY_FOLDERS } from "../../../config/cloudinary";
import { uploadDocumentFromBuffer, uploadImageFromBuffer } from "../../../services/cloudinaryService";

/**
 * Get all sellers (for dropdowns/lists)
 */
export const getAllSellers = asyncHandler(async (_req: Request, res: Response) => {
    // Return all fields for admin management
    const sellers = await Seller.find({})
        .sort({ createdAt: -1 });

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

    const updateData: any = { isEnabled };
    if (isEnabled === false) {
        updateData.canCreateCategories = false;
    }

    const seller = await Seller.findByIdAndUpdate(
        id,
        updateData,
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

/**
 * Create a new seller
 */
export const createSeller = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const body = req.body;

    // Check if seller already exists
    const existingSeller = await Seller.findOne({
        $or: [{ email: body.email }, { mobile: body.mobile }]
    });

    if (existingSeller) {
        return res.status(400).json({
            success: false,
            message: "Seller with this email or mobile already exists",
        });
    }

    // Upload files to Cloudinary
    let profileUrl = "";
    let idProofUrl = "";
    let addressProofUrl = "";

    if (files?.profile?.[0]) {
        const result = await uploadImageFromBuffer(files.profile[0].buffer, { folder: CLOUDINARY_FOLDERS.SELLER_PROFILE });
        profileUrl = result.secureUrl;
    }

    if (files?.idProof?.[0]) {
        const result = await uploadDocumentFromBuffer(files.idProof[0].buffer, { folder: CLOUDINARY_FOLDERS.SELLER_DOCUMENTS });
        idProofUrl = result.secureUrl;
    }

    if (files?.addressProof?.[0]) {
        const result = await uploadDocumentFromBuffer(files.addressProof[0].buffer, { folder: CLOUDINARY_FOLDERS.SELLER_DOCUMENTS });
        addressProofUrl = result.secureUrl;
    }

    // Prepare seller data
    // Map frontend fields to backend schema
    const newSeller = await Seller.create({
        // Auth
        sellerName: body.sellerName,
        email: body.email,
        password: body.password || "123456", // Default password if not provided
        mobile: body.mobile,

        // Store Info
        storeName: body.storeName,
        category: body.selectCategory,
        address: body.address,
        panCard: body.panCard,
        taxName: body.taxName,
        taxNumber: body.taxNumber,

        // Location
        city: body.city,
        serviceableArea: body.serviceableArea,
        searchLocation: body.searchLocation,
        latitude: body.latitude,
        longitude: body.longitude,
        location: {
            type: 'Point',
            coordinates: [
                parseFloat(body.longitude) || 77.2090,
                parseFloat(body.latitude) || 28.6139
            ]
        },

        // Payment
        accountName: body.accountName,
        bankName: body.bankName,
        branch: body.branch,
        accountNumber: body.accountNumber,
        ifsc: body.ifsc,

        // Documents
        profile: profileUrl,
        idProof: idProofUrl,
        addressProof: addressProofUrl,

        // Settings
        requireProductApproval: body.requireProductApproval === 'Yes',
        viewCustomerDetails: body.viewCustomerDetails === 'Yes',
        commission: parseFloat(body.commission) || 0,

        // Status
        status: 'Approved', // Auto-approve for now based on typical admin requirement
        isEnabled: true
    });

    res.status(201).json({
        success: true,
        message: "Seller created successfully",
        data: newSeller
    });
});
