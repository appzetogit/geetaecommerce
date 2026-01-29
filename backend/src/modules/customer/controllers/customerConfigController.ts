import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import AppSettings from "../../../models/AppSettings";

/**
 * Get public application configuration
 * Returns only safe, public-facing settings
 */
export const getPublicConfig = asyncHandler(
  async (_req: Request, res: Response) => {
    // defaults
    const defaultConfig = {
      deliveryFee: 40,
      freeDeliveryThreshold: 199,
      platformFee: 2,
      taxes: { gst: 18 },
      estimatedDeliveryTime: "12-15 mins",
      deliveryRadius: 10,
      serviceType: "Delivery",
      appName: "Geeta Stores"
    };

    try {
      const settings = await AppSettings.findOne();

      if (!settings) {
        return res.status(200).json({
          success: true,
          data: defaultConfig
        });
      }

      // Map settings to public config structure
      // Ensure we handle potential missing fields in database by falling back to defaults or 0
      const publicConfig = {
        deliveryFee: settings.deliveryCharges ?? defaultConfig.deliveryFee,
        freeDeliveryThreshold: settings.freeDeliveryThreshold ?? defaultConfig.freeDeliveryThreshold,
        deliveryRadius: settings.deliveryRadius ?? defaultConfig.deliveryRadius,
        serviceType: settings.serviceType ?? defaultConfig.serviceType,
        platformFee: defaultConfig.platformFee,
        taxes: {
          gst: settings.gstEnabled ? (settings.gstRate ?? 18) : 0
        },
        estimatedDeliveryTime: defaultConfig.estimatedDeliveryTime,
        appName: settings.appName ?? defaultConfig.appName,
        contactPhone: settings.contactPhone,
        contactEmail: settings.contactEmail,
        onlinePaymentDiscount: settings.onlinePaymentDiscount || { enabled: false, percentage: 0 }
      };

      return res.status(200).json({
        success: true,
        message: "Config retrieved successfully",
        data: publicConfig,
      });
    } catch (error) {
      console.error("Error fetching public config:", error);
      return res.status(200).json({
        success: true,
        data: defaultConfig
      });
    }
  }
);
