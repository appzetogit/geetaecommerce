
import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import StockLedger from "../../../models/StockLedger";
import Product from "../../../models/Product";

/**
 * Update POS Stock Ledger Entry
 */
export const updateStockLedgerEntry = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { quantity, type, source, updateStock } = req.body;

    // updateStock: boolean - if true, we adjust the product stock based on the difference

    const ledgerEntry = await StockLedger.findById(id);
    if (!ledgerEntry) {
      return res.status(404).json({ success: false, message: "Ledger entry not found" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // If critical fields are changed and updateStock is requested
        if (updateStock && (quantity !== undefined || type !== undefined)) {
            const oldQty = ledgerEntry.quantity;
            const oldType = ledgerEntry.type;

            const newQty = quantity !== undefined ? Number(quantity) : oldQty;
            const newType = type || oldType;

            // Calculate impact
            // IN: +1 (Stock added), OUT: -1 (Stock removed)
            const oldSign = oldType === 'IN' ? 1 : -1;
            const newSign = newType === 'IN' ? 1 : -1;

            const oldImpact = oldQty * oldSign; // e.g. 5 IN = +5. 5 OUT = -5.
            const newImpact = newQty * newSign; // e.g. 3 OUT = -3.

            // We need to adjust the current stock by the difference (New - Old)
            // Example: Was 5 IN (+5). Becomes 3 OUT (-3). Diff = -3 - 5 = -8.
            // Stock should decrease by 8.
            const diff = newImpact - oldImpact;

            if (diff !== 0) {
                 const product = await Product.findById(ledgerEntry.product).session(session);
                 if (product) {
                     // Check if variation
                     if (ledgerEntry.variationId && product.variations) {
                         const vIndex = product.variations.findIndex((v: any) => v._id?.toString() === ledgerEntry.variationId.toString());
                         if (vIndex > -1) {
                             const currentVarStock = product.variations[vIndex].stock || 0;
                             product.variations[vIndex].stock = Math.max(0, currentVarStock + diff);
                         }
                     }

                     // Helper to sum variations stock if desired, but Geeta stores both.
                     // We update main stock too.
                     const currentStock = product.stock || 0;
                     product.stock = Math.max(0, currentStock + diff);

                     await product.save({ session });
                 }
            }
        }

        if (quantity !== undefined) ledgerEntry.quantity = Number(quantity);
        if (type) ledgerEntry.type = type;
        if (source) ledgerEntry.source = source;
        if (updateStock !== undefined) ledgerEntry.updateStock = updateStock; // Assuming we might want to track this, but model might not have it. Ignore if not in schema.

        await ledgerEntry.save({ session });
        await session.commitTransaction();

        return res.status(200).json({
            success: true,
            message: "Stock ledger entry updated",
            data: ledgerEntry
        });

    } catch (error: any) {
        await session.abortTransaction();
        console.error("updateStockLedgerEntry Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
  }
);
