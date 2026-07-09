import { Request } from "express";
import Order from "../../models/Order";
import OrderItem from "../../models/OrderItem";
import Product from "../../models/Product";
import StockLedger from "../../models/StockLedger";
import {
  getPhonePePaymentStatus,
  isPhonePeConfigured,
} from "../../services/phonepeService";

/**
 * Verify PhonePe payment (when configured) and mark POS online order complete + deduct stock.
 */
export async function completePosOnlinePayment(
  req: Request,
  orderId: string,
  paymentRef?: string
): Promise<{ success: boolean; message: string }> {
  const order = await Order.findById(orderId);
  if (!order) {
    return { success: false, message: "Order not found" };
  }

  if (order.paymentStatus === "Paid") {
    return { success: true, message: "Order already paid" };
  }

  const merchantTransactionId =
    paymentRef || order.paymentId || undefined;

  if (merchantTransactionId && isPhonePeConfigured()) {
    const status = await getPhonePePaymentStatus(merchantTransactionId);
    if (!status.success) {
      return {
        success: false,
        message: `Payment not completed (${status.state || "UNKNOWN"})`,
      };
    }
    order.paymentId = status.transactionId || merchantTransactionId;
  }

  const isSellerPos = String(order.adminNotes || "").includes(
    "POS Order - Seller:"
  );
  const sellerId = isSellerPos
    ? String(order.adminNotes || "")
        .match(/POS Order - Seller:\s*([a-f\d]{24})/i)?.[1]
    : undefined;

  order.paymentStatus = "Paid";
  order.status = "Delivered";
  order.deliveryBoyStatus = "Delivered";
  order.deliveredAt = new Date();
  order.adminNotes =
    (order.adminNotes || "") +
    `\nPayment Verified (ID: ${order.paymentId || paymentRef || "N/A"})`;

  await order.save();

  const orderItems = await OrderItem.find({ order: order._id });
  for (const item of orderItems) {
    if (!item.product) continue;

    const product = await Product.findById(item.product);
    if (!product) continue;

    const productDoc = product as any;
    const prevStock = Number(productDoc.stock) || 0;
    const soldQty = item.quantity;
    let stockUpdated = false;

    if (item.sku && product.variations?.length) {
      const vIndex = product.variations.findIndex((v) => v.sku === item.sku);
      if (vIndex > -1) {
        const prevVarStock = product.variations[vIndex].stock || 0;
        product.variations[vIndex].stock = Math.max(0, prevVarStock - soldQty);
        productDoc.stock = Math.max(0, prevStock - soldQty);
        await product.save();

        await StockLedger.create({
          product: product._id,
          variationId: product.variations[vIndex]._id,
          sku: item.sku,
          quantity: soldQty,
          type: "OUT",
          source: "POS",
          referenceId: order._id,
          previousStock: prevVarStock,
          newStock: product.variations[vIndex].stock,
          ...(sellerId
            ? { seller: sellerId }
            : { admin: req.user?.userId }),
        });
        stockUpdated = true;
      }
    }

    if (!stockUpdated) {
      productDoc.stock = Math.max(0, prevStock - soldQty);
      await product.save();

      await StockLedger.create({
        product: product._id,
        sku: item.sku || productDoc.sku || "N/A",
        quantity: soldQty,
        type: "OUT",
        source: "POS",
        referenceId: order._id,
        previousStock: prevStock,
        newStock: productDoc.stock,
        ...(sellerId ? { seller: sellerId } : { admin: req.user?.userId }),
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("stock-update", {
        productId: product._id,
        newStock: productDoc.stock,
      });
    }
  }

  await OrderItem.updateMany({ order: order._id }, { status: "Delivered" });

  return { success: true, message: "Payment verified and order completed" };
}
