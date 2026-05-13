import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Product from "../../../models/Product";
import StockLedger from "../../../models/StockLedger";

/**
 * Delete Order and Restore Stock
 */
export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const order = await Order.findById(id).populate("items");
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  // Restriction: Cannot delete orders with customer names
  if (order.customerName && order.customerName.trim() !== "" && order.customerName.toLowerCase() !== "walk-in customer") {
    return res.status(403).json({
      success: false,
      message: "Orders with registered customer names cannot be deleted to maintain data integrity."
    });
  }

  const orderItems = await OrderItem.find({ order: order._id }).populate("product");

  for (const item of orderItems) {
    if (!item.product) continue;

    const product = await Product.findById(item.product as any);
    if (!product) continue;

    const previousStock = product.stock;
    const returnQty = item.quantity;

    let stockRestored = false;
    if (item.sku && product.variations) {
      const vIndex = product.variations.findIndex((v: any) => v.sku === item.sku);
      if (vIndex > -1) {
        const previousVariationStock = product.variations[vIndex].stock || 0;
        product.variations[vIndex].stock = previousVariationStock + returnQty;
        product.stock = previousStock + returnQty;
        await product.save();

        await StockLedger.create({
          product: product._id,
          variationId: product.variations[vIndex]._id,
          sku: item.sku,
          quantity: returnQty,
          type: "IN",
          source: "ORDER_DELETE",
          referenceId: order._id,
          previousStock: previousVariationStock,
          newStock: product.variations[vIndex].stock,
          admin: req.user?.userId,
        });

        stockRestored = true;
      }
    }

    if (!stockRestored) {
      product.stock = previousStock + returnQty;
      await product.save();

      await StockLedger.create({
        product: product._id,
        sku: item.sku || (product as any).sku || "N/A",
        quantity: returnQty,
        type: "IN",
        source: "ORDER_DELETE",
        referenceId: order._id,
        previousStock,
        newStock: product.stock,
        admin: req.user?.userId,
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("stock-update", {
        productId: product._id,
        newStock: product.stock,
      });
    }
  }

  await OrderItem.deleteMany({ order: order._id });
  await Order.findByIdAndDelete(id);

  return res.status(200).json({
    success: true,
    message: "Order deleted and stock restored successfully",
  });
});

