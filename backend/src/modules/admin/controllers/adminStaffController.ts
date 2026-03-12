import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Staff from "../../../models/Staff";

/**
 * Get all staff for current module (admin side)
 */
export const getStaffList = asyncHandler(async (req: Request, res: Response) => {
  const module: "admin" | "seller" = req.user?.userType === "Seller" ? "seller" : "admin";

  const staff = await Staff.find({ module }).sort({ createdAt: -1 }).lean();

  return res.status(200).json({
    success: true,
    message: "Staff list fetched successfully",
    data: staff,
  });
});

/**
 * Create staff
 */
export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const module: "admin" | "seller" = req.user?.userType === "Seller" ? "seller" : "admin";
  const { name, phone, role, commission, permissions } = req.body;

  if (!name || !phone || !role) {
    return res.status(400).json({
      success: false,
      message: "Name, phone and role are required",
    });
  }

  if (!/^[0-9]{10}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "Phone number must be exactly 10 digits",
    });
  }

  const existing = await Staff.findOne({ phone, module });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "Staff with this phone already exists",
    });
  }

  const staff = await Staff.create({
    name,
    phone,
    role,
    commission: commission ?? 0,
    permissions: Array.isArray(permissions) && permissions.length > 0 ? permissions : undefined,
    module,
  });

  return res.status(201).json({
    success: true,
    message: "Staff created successfully",
    data: staff.toObject(),
  });
});

/**
 * Update staff
 */
export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const module: "admin" | "seller" = req.user?.userType === "Seller" ? "seller" : "admin";
  const { id } = req.params;
  const { name, phone, role, commission, permissions } = req.body;

  const staff = await Staff.findOne({ _id: id, module });

  if (!staff) {
    return res.status(404).json({
      success: false,
      message: "Staff not found",
    });
  }

  if (phone && !/^[0-9]{10}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "Phone number must be exactly 10 digits",
    });
  }

  if (phone && phone !== staff.phone) {
    const existing = await Staff.findOne({ phone, module, _id: { $ne: id } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Another staff member already exists with this phone",
      });
    }
  }

  if (name !== undefined) staff.name = name;
  if (phone !== undefined) staff.phone = phone;
  if (role !== undefined) staff.role = role;
  if (commission !== undefined) staff.commission = commission;
  if (permissions !== undefined) staff.permissions = permissions;

  await staff.save();

  return res.status(200).json({
    success: true,
    message: "Staff updated successfully",
    data: staff.toObject(),
  });
});

/**
 * Delete staff
 */
export const deleteStaff = asyncHandler(async (req: Request, res: Response) => {
  const module: "admin" | "seller" = req.user?.userType === "Seller" ? "seller" : "admin";
  const { id } = req.params;

  const staff = await Staff.findOneAndDelete({ _id: id, module });

  if (!staff) {
    return res.status(404).json({
      success: false,
      message: "Staff not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Staff deleted successfully",
  });
});


