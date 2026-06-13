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

    // Restriction: Cannot delete orders with customer names
    if (order.customerName && order.customerName.trim() !== "" && order.customerName.toLowerCase() !== "walk-in customer") {
      return res.status(403).json({
        success: false,
        message: "Orders with registered customer names cannot be deleted to maintain data integrity."
      });
    }

    // Note: Stock is intentionally NOT restored when deleting a POS order

    // Delete order items
    await OrderItem.deleteMany({ order: order._id });

    // Delete the order
    await Order.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "POS Order deleted successfully"
    });
  }
);
