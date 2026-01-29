import Notification from "../models/Notification";
import Admin from "../models/Admin";
import Seller from "../models/Seller";
import Customer from "../models/Customer";
import Delivery from "../models/Delivery";

/**
 * Send notification to specific user
 */
export const sendNotification = async (
  recipientType: "Admin" | "Seller" | "Customer" | "Delivery",
  recipientId: string,
  title: string,
  message: string,
  options?: {
    type?:
      | "Info"
      | "Success"
      | "Warning"
      | "Error"
      | "Order"
      | "Payment"
      | "System";
    link?: string;
    actionLabel?: string;
    priority?: "Low" | "Medium" | "High" | "Urgent";
    expiresAt?: Date;
  }
) => {
  const notification = await Notification.create({
    recipientType,
    recipientId,
    title,
    message,
    type: options?.type || "Info",
    link: options?.link,
    actionLabel: options?.actionLabel,
    priority: options?.priority || "Medium",
    expiresAt: options?.expiresAt,
    isRead: false,
  });

  // Here you would integrate with push notification service (FCM, APNS, etc.)
  // For now, we'll just create the notification record

  return notification;
};

/**
 * Send notification to all users of a type
 */
export const sendBroadcastNotification = async (
  recipientType: "Admin" | "Seller" | "Customer" | "Delivery",
  title: string,
  message: string,
  options?: {
    type?:
      | "Info"
      | "Success"
      | "Warning"
      | "Error"
      | "Order"
      | "Payment"
      | "System";
    link?: string;
    actionLabel?: string;
    priority?: "Low" | "Medium" | "High" | "Urgent";
    expiresAt?: Date;
  }
) => {
  // Get all users of the specified type
  let userIds: string[] = [];

  switch (recipientType) {
    case "Admin":
      const admins = await Admin.find().select("_id");
      userIds = admins.map((a) => a._id.toString());
      break;
    case "Seller":
      const sellers = await Seller.find().select("_id");
      userIds = sellers.map((s) => s._id.toString());
      break;
    case "Customer":
      const customers = await Customer.find().select("_id");
      userIds = customers.map((c) => c._id.toString());
      break;
    case "Delivery":
      const deliveries = await Delivery.find().select("_id");
      userIds = deliveries.map((d) => d._id.toString());
      break;
  }

  // Create notifications for all users
  const notifications = await Promise.all(
    userIds.map((userId) =>
      Notification.create({
        recipientType,
        recipientId: userId,
        title,
        message,
        type: options?.type || "Info",
        link: options?.link,
        actionLabel: options?.actionLabel,
        priority: options?.priority || "Medium",
        expiresAt: options?.expiresAt,
        isRead: false,
      })
    )
  );

  return notifications;
};

/**
 * Send order status notification
 */
export const sendOrderStatusNotification = async (
  orderId: string,
  customerId: string,
  status: string
) => {
  const statusMessages: Record<string, { title: string; message: string }> = {
    Processed: {
      title: "Order Processed",
      message:
        "Your order has been processed and is being prepared for shipment.",
    },
    Shipped: {
      title: "Order Shipped",
      message: "Your order has been shipped and is on its way!",
    },
    "Out for Delivery": {
      title: "Out for Delivery",
      message: "Your order is out for delivery and will reach you soon.",
    },
    Delivered: {
      title: "Order Delivered",
      message:
        "Your order has been delivered successfully. Thank you for shopping with us!",
    },
    Cancelled: {
      title: "Order Cancelled",
      message:
        "Your order has been cancelled. If you have any questions, please contact support.",
    },
  };

  const statusInfo = statusMessages[status];
  if (!statusInfo) return;

  return sendNotification(
    "Customer",
    customerId,
    statusInfo.title,
    statusInfo.message,
    {
      type: "Order",
      link: `/orders/${orderId}`,
      priority: status === "Cancelled" ? "High" : "Medium",
    }
  );
};

/**
 * Send product approval notification
 */
export const sendProductApprovalNotification = async (
  sellerId: string,
  productId: string,
  status: "Approved" | "Rejected",
  rejectionReason?: string
) => {
  const title = status === "Approved" ? "Product Approved" : "Product Rejected";
  const message =
    status === "Approved"
      ? "Your product has been approved and is now live on the platform."
      : `Your product has been rejected. Reason: ${
          rejectionReason || "Not specified"
        }`;

  return sendNotification("Seller", sellerId, title, message, {
    type: status === "Approved" ? "Success" : "Error",
    link: `/products/${productId}`,
    priority: "Medium",
  });
};
