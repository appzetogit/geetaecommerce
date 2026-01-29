import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Notification from "../../../models/Notification";
import Customer from "../../../models/Customer";
import Seller from "../../../models/Seller";
import Delivery from "../../../models/Delivery";
import Admin from "../../../models/Admin";
import { sendPushNotification } from "../../../services/firebaseAdmin";

/**
 * Create a new notification and send real-time push
 */
export const createNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      recipientType,
      recipientId,
      title,
      message,
      type,
      link,
      actionLabel,
      priority,
      expiresAt,
    } = req.body;

    if (!recipientType || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "Recipient type, title, and message are required",
      });
    }

    // 1. Fetch Tokens based on recipientType
    let targetTokens: string[] = [];

    const fetchTokensFromModel = async (Model: any) => {
      const users = await Model.find({
        $or: [
          { fcmToken: { $exists: true, $ne: "" } },
          { fcmTokenMobile: { $exists: true, $ne: "" } }
        ]
      }).select('fcmToken fcmTokenMobile');

      users.forEach((u: any) => {
        if (u.fcmToken) targetTokens.push(u.fcmToken);
        if (u.fcmTokenMobile) targetTokens.push(u.fcmTokenMobile);
      });
    };

    if (recipientType === 'All') {
      await Promise.all([
        fetchTokensFromModel(Customer),
        fetchTokensFromModel(Seller),
        fetchTokensFromModel(Delivery),
        fetchTokensFromModel(Admin)
      ]);
    } else if (recipientType === 'Customer') {
      await fetchTokensFromModel(Customer);
    } else if (recipientType === 'Seller') {
      await fetchTokensFromModel(Seller);
    } else if (recipientType === 'Delivery') {
      await fetchTokensFromModel(Delivery);
    } else if (recipientType === 'Admin') {
      await fetchTokensFromModel(Admin);
    }

    // 2. Send Push Notification if tokens found
    let fcmResult = null;
    if (targetTokens.length > 0) {
      console.log(`[ADMIN-NOTIF] Sending to ${targetTokens.length} tokens for ${recipientType}`);
      fcmResult = await sendPushNotification(targetTokens, {
        title,
        body: message,
        data: { link, type: type || 'Info' }
      });
    } else {
      console.log(`[ADMIN-NOTIF] No active FCM tokens found for ${recipientType}`);
    }

    // 3. Save to Database
    const notification = await Notification.create({
      recipientType,
      recipientId,
      title,
      message,
      type: type || "Info",
      link,
      actionLabel,
      priority: priority || "Medium",
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: req.user?.userId,
      isRead: false,
      sentAt: fcmResult ? new Date() : undefined
    });

    // 4. Emit Socket Notification for real-time UI updates
    const io = req.app.get('io');
    if (io) {
      const socketPayload = {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link: notification.link,
        createdAt: notification.createdAt,
        isRead: false
      };

      if (recipientType === 'All') {
        io.emit('new-notification', socketPayload);
      } else if (recipientType === 'Admin') {
        io.to('admin-notifications').emit('new-notification', socketPayload);
      } else if (recipientType === 'Seller' && recipientId) {
        io.to(`seller-${recipientId}`).emit('new-notification', socketPayload);
      } else if (recipientType === 'Delivery' && recipientId) {
        io.to(`delivery-${recipientId}`).emit('new-notification', socketPayload);
      } else if (recipientId) {
        // Fallback for specific user IDs if recipientType is Customer etc.
        io.to(`user-${recipientId}`).emit('new-notification', socketPayload);
      }
    }

    return res.status(201).json({
      success: true,
      message: fcmResult
        ? `Notification sent to ${fcmResult.successCount} devices and saved to DB`
        : "Notification saved to DB (No active devices found)",
      data: notification,
      fcmStats: fcmResult ? {
        success: fcmResult.successCount,
        failure: fcmResult.failureCount
      } : null
    });
  }
);

/**
 * Get all notifications
 */
export const getNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      recipientType,
      recipientId,
      isRead,
      type,
      priority,
    } = req.query;

    const query: any = {};

    if (recipientType) query.recipientType = recipientType;
    if (recipientId) query.recipientId = recipientId;
    if (isRead !== undefined) query.isRead = isRead === "true";
    if (type) query.type = type;
    if (priority) query.priority = priority;

    // Filter expired notifications
    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gte: new Date() } },
    ];

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate("createdBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Notification.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: notifications,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Get notification by ID
 */
export const getNotificationById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const notification = await Notification.findById(id).populate(
      "createdBy",
      "firstName lastName"
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification fetched successfully",
      data: notification,
    });
  }
);

/**
 * Mark notification as read
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const notification = await Notification.findByIdAndUpdate(
    id,
    {
      isRead: true,
      readAt: new Date(),
    },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Notification not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Notification marked as read",
    data: notification,
  });
});

/**
 * Update notification
 */
export const updateNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const notification = await Notification.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification updated successfully",
      data: notification,
    });
  }
);

/**
 * Send notification (Push to users)
 * This is a placeholder for actual push notification logic (Firebase/Socket.io)
 * For now, just mark it as sent.
 */
export const sendNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Logic to send push notification would go here
    // e.g. await pushNotificationService.send(notification);

    notification.sentAt = new Date();
    await notification.save();

    return res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      data: notification,
    });
  }
);

/**
 * Mark multiple notifications as read
 */
export const markMultipleAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Notification IDs array is required",
      });
    }

    const result = await Notification.updateMany(
      { _id: { $in: notificationIds } },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: {
        modified: result.modifiedCount,
      },
    });
  }
);

/**
 * Delete notification
 */
export const deleteNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  }
);
