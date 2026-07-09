import mongoose from "mongoose";
import Order from "../../models/Order";
import OrderItem from "../../models/OrderItem";
import Product from "../../models/Product";
import Customer from "../../models/Customer";
import {
  buildPhonePeMerchantTransactionId,
  initiatePhonePePayment,
  isPhonePeConfigured,
} from "../../services/phonepeService";

export interface InitiatePosOnlineInput {
  customerId: string;
  items: any[];
  gateway?: string;
  sellerId?: string;
  redirectPathPrefix: string;
}

export async function initiatePosOnlineOrderCore(input: InitiatePosOnlineInput) {
  let { customerId, items, gateway, sellerId, redirectPathPrefix } = input;

  if (!customerId || !items?.length) {
    throw new Error("Missing required fields");
  }

  if (customerId === "walk-in-customer") {
    let walkIn = await Customer.findOne({ email: "walkin@pos.com" });
    if (!walkIn) {
      walkIn = await Customer.create({
        name: "Walk-in Customer",
        email: "walkin@pos.com",
        phone: "0000000000",
        status: "Active",
      });
    }
    customerId = walkIn._id.toString();
  }

  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error("Customer not found");
  }

  let subtotal = 0;
  let taxTotal = 0;
  const orderItemsPayload: any[] = [];

  for (const item of items) {
    let productData: any = {
      productName: item.name || "Custom Item",
      mainImage: "",
      sku: "",
      seller: null,
    };
    let productId = null;
    let product: any = null;

    if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
      product = await Product.findById(item.productId).populate("seller");
      if (product) {
        productId = product._id;
        productData = {
          productName: product.productName,
          mainImage: product.mainImage,
          sku: product.sku,
          seller: product.seller
            ? (product.seller as any)._id || product.seller
            : null,
        };
      }
    }

    const total = Number(item.price) * Number(item.quantity);
    subtotal += total;

    const payloadHsnCode =
      typeof item.hsnCode === "string" && item.hsnCode.trim()
        ? item.hsnCode.trim()
        : typeof item.hsn === "string" && item.hsn.trim()
          ? item.hsn.trim()
          : "";
    const resolvedHsnCode =
      payloadHsnCode ||
      (typeof product?.hsnCode === "string"
        ? String(product.hsnCode).trim()
        : "");

    const payloadGstRateRaw =
      item.gst !== undefined && item.gst !== null && item.gst !== ""
        ? Number(item.gst)
        : item.gstPercent !== undefined &&
            item.gstPercent !== null &&
            item.gstPercent !== ""
          ? Number(item.gstPercent)
          : NaN;
    const resolvedGstRate = Number.isFinite(payloadGstRateRaw)
      ? payloadGstRateRaw
      : Number.isFinite(Number(product?.gst))
        ? Number(product.gst)
        : 5;
    const safeGstRate = resolvedGstRate >= 0 ? resolvedGstRate : 5;
    const resolvedGstAmount =
      safeGstRate > 0
        ? Number(((total * safeGstRate) / (100 + safeGstRate)).toFixed(2))
        : 0;
    taxTotal += resolvedGstAmount;

    const payload: any = {
      productName: productData.productName,
      productImage: productData.mainImage,
      sku: productData.sku,
      mrp: Number(item.mrp) || 0,
      unitPrice: item.price,
      quantity: item.quantity,
      total,
      hsnCode: resolvedHsnCode,
      gst: safeGstRate,
      gstAmount: resolvedGstAmount,
      warrantyType: item.warrantyType || product?.warrantyType || "None",
      warrantyDuration: item.warrantyDuration || product?.warrantyDuration || "",
      status: "Pending",
    };
    if (productId) payload.product = productId;
    if (productData.seller) payload.seller = productData.seller;

    orderItemsPayload.push(payload);
  }

  const adminNotes = sellerId
    ? `POS Online Order via PhonePe - Seller: ${sellerId}`
    : "POS Online Order via PhonePe";

  const order = await Order.create({
    customer: customer._id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    deliveryAddress: {
      address: customer.address || "POS Order",
      city: customer.city || "POS",
      pincode: customer.pincode || "000000",
      state: customer.state || "POS",
    },
    items: [],
    subtotal,
    tax: Number(taxTotal.toFixed(2)),
    total: subtotal,
    paymentMethod: "PhonePe",
    paymentStatus: "Pending",
    status: "Pending",
    adminNotes,
  });

  const itemIds = [];
  for (const payload of orderItemsPayload) {
    payload.order = order._id;
    const item = await OrderItem.create(payload);
    itemIds.push(item._id);
  }
  order.items = itemIds;

  const normalizedGateway = String(gateway || "").toLowerCase();
  const usePhonePe =
    normalizedGateway === "phonepe" ||
    normalizedGateway === "online" ||
    !normalizedGateway;

  if (!usePhonePe) {
    throw new Error("Invalid Gateway. Use PhonePe or Online.");
  }

  if (!isPhonePeConfigured()) {
    throw new Error(
      "PhonePe is not configured. Set PHONEPE_MERCHANT_ID and PHONEPE_SALT_KEY."
    );
  }

  const amountInPaise = Math.round(subtotal * 100);
  const merchantTransactionId = buildPhonePeMerchantTransactionId(
    sellerId ? "SPOS" : "POS",
    order._id.toString()
  );
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(
    /\/$/,
    ""
  );
  const redirectUrl = `${frontendUrl}${redirectPathPrefix}/pos/success?order_id=${order._id}&merchantTransactionId=${merchantTransactionId}`;

  const phonePeResult = await initiatePhonePePayment({
    merchantTransactionId,
    merchantUserId: customer._id.toString(),
    amountPaise: amountInPaise,
    redirectUrl,
    mobileNumber: customer.phone || "9999999999",
  });

  order.paymentId = merchantTransactionId;
  await order.save();

  return {
    gateway: "PhonePe",
    orderId: order._id,
    merchantTransactionId,
    redirectUrl: phonePeResult.redirectUrl,
    amount: subtotal,
    customer: {
      name: customer.name,
      email: customer.email,
      contact: customer.phone,
    },
  };
}
