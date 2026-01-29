import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Product from "../../../models/Product";
import StockLedger from "../../../models/StockLedger";

/**
 * Delete POS Order and Restore Stock
 */
export const deletePOSOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Find the order with populated items
    const order = await Order.findById(id).populate('items');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check if it's a POS order (has adminNotes containing "POS")
    if (!order.adminNotes?.includes('POS')) {
      return res.status(400).json({
        success: false,
        message: "Only POS orders can be deleted"
      });
    }

    // Restore stock for each item
    const orderItems = await OrderItem.find({ order: order._id }).populate('product');

    for (const item of orderItems) {
      if (item.product) {
        const product = await Product.findById(item.product as any);
        if (product) {
          const prevStock = product.stock;
          const returnQty = item.quantity;

          // Check if item has variation (by SKU match)
          let stockRestored = false;
          if (item.sku && product.variations) {
            const vIndex = product.variations.findIndex(v => v.sku === item.sku);
            if (vIndex > -1) {
              const prevVarStock = product.variations[vIndex].stock || 0;
              product.variations[vIndex].stock = prevVarStock + returnQty;
              product.stock = prevStock + returnQty;
              await product.save();

              // Create stock ledger entry
              await StockLedger.create({
                product: product._id,
                variationId: product.variations[vIndex]._id,
                sku: item.sku,
                quantity: returnQty,
                type: "IN",
                source: "POS_CANCEL",
                referenceId: order._id,
                previousStock: prevVarStock,
                newStock: product.variations[vIndex].stock,
                admin: req.user?.userId
              });
              stockRestored = true;
            }
          }

          if (!stockRestored) {
            product.stock = prevStock + returnQty;
            await product.save();

            // Create stock ledger entry
            await StockLedger.create({
              product: product._id,
              sku: item.sku || product.sku || "N/A",
              quantity: returnQty,
              type: "IN",
              source: "POS_CANCEL",
              referenceId: order._id,
              previousStock: prevStock,
              newStock: product.stock,
              admin: req.user?.userId
            });
          }

          // Emit socket event for real-time stock update
          const io = req.app.get("io");
          if (io) {
            io.emit("stock-update", {
              productId: product._id,
              newStock: product.stock
            });
          }
        }
      }
    }

    // Delete order items
    await OrderItem.deleteMany({ order: order._id });

    // Delete the order
    await Order.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "POS Order deleted and stock restored successfully"
    });
  }
);
