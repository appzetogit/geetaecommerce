import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import AdminPurchaseEntry from "../../../models/AdminPurchaseEntry";

/**
 * Get admin purchase/quotation entries
 */
export const getAdminPurchaseEntries = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = (req as any).user.userId;
    const { type } = req.query;
    const query: any = { admin: adminId };
    if (type === "purchase" || type === "quotation") {
      query.type = type;
    }

    const entries = await AdminPurchaseEntry.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Purchase entries fetched successfully",
      data: entries.map((entry) => {
        const payload = (entry.data || {}) as any;
        return {
          ...payload,
          id: payload.id || entry.entryId,
          type: payload.type || entry.type,
          date: payload.date || entry.date || "",
        };
      }),
    });
  }
);

/**
 * Create or update admin purchase/quotation entry
 */
export const upsertAdminPurchaseEntry = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = (req as any).user.userId;
    const entry = req.body;

    if (!entry || !entry.id) {
      return res.status(400).json({
        success: false,
        message: "Entry id is required",
      });
    }

    const type = entry.type === "quotation" ? "quotation" : "purchase";

    const saved = await AdminPurchaseEntry.findOneAndUpdate(
      { admin: adminId, entryId: String(entry.id) },
      {
        admin: adminId,
        entryId: String(entry.id),
        type,
        date: entry.date || "",
        data: entry,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Purchase entry saved successfully",
      data: {
        ...(saved?.data || entry),
        id: (saved?.data as any)?.id || saved?.entryId || String(entry.id),
      },
    });
  }
);

/**
 * Delete admin purchase/quotation entry
 */
export const deleteAdminPurchaseEntry = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = (req as any).user.userId;
    const { entryId } = req.params;

    const deleted = await AdminPurchaseEntry.findOneAndDelete({
      admin: adminId,
      entryId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Purchase entry not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Purchase entry deleted successfully",
    });
  }
);

