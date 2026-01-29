import Order from '../models/Order';

/**
 * Generate a 6-digit delivery OTP and send it to customer via SMS
 */
export async function generateDeliveryOtp(orderId: string, customerPhone: string): Promise<{ success: boolean; message: string }> {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'Delivered') {
      throw new Error('Order is already delivered');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in order
    order.deliveryOtp = otp;
    order.deliveryOtpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry
    order.deliveryOtpVerified = false;
    await order.save();

    // Send SMS OTP to customer
    try {
      const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY;

      if (TWOFACTOR_API_KEY && TWOFACTOR_API_KEY !== 'your_2factor_api_key') {
        const axios = require('axios');
        // Send SMS with the generated OTP
        const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${customerPhone}/${otp}/DELIVERY_OTP`;
        try {
          await axios.get(url);
          console.log(`Delivery OTP ${otp} sent to ${customerPhone} for order ${orderId}`);
        } catch (smsError: any) {
          console.error('Failed to send delivery OTP SMS:', smsError.message);
          // Continue even if SMS fails - OTP is stored in order
        }
      } else {
        console.log(`[MOCK MODE] Delivery OTP ${otp} for order ${orderId} to ${customerPhone}`);
      }
    } catch (smsError: any) {
      console.error('Error sending delivery OTP SMS:', smsError.message);
      // Continue - OTP is stored in order, can be retrieved manually if SMS fails
    }

    return {
      success: true,
      message: 'Delivery OTP sent successfully to customer',
    };
  } catch (error: any) {
    console.error('Error generating delivery OTP:', error);
    throw new Error(error.message || 'Failed to generate delivery OTP');
  }
}

/**
 * Verify delivery OTP and mark order as delivered if valid
 */
export async function verifyDeliveryOtp(orderId: string, otp: string): Promise<{ success: boolean; message: string }> {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (!order.deliveryOtp) {
      throw new Error('No delivery OTP generated for this order');
    }

    if (order.deliveryOtpVerified) {
      throw new Error('OTP already verified');
    }

    if (order.deliveryOtpExpiresAt && order.deliveryOtpExpiresAt < new Date()) {
      throw new Error('Delivery OTP has expired. Please request a new OTP.');
    }

    // Developer bypass
    if ((process.env.NODE_ENV !== 'production' || process.env.USE_MOCK_OTP === 'true') && otp === '999999') {
      order.deliveryOtpVerified = true;
      order.status = 'Delivered';
      order.deliveredAt = new Date();
      order.invoiceEnabled = true;
      await order.save();

      return {
        success: true,
        message: 'OTP verified successfully. Order marked as delivered.',
      };
    }

    // Verify OTP
    if (order.deliveryOtp !== otp) {
      throw new Error('Invalid OTP. Please check and try again.');
    }

    // Mark OTP as verified and update order status
    order.deliveryOtpVerified = true;
    order.status = 'Delivered';
    order.deliveredAt = new Date();
    order.invoiceEnabled = true;
    await order.save();

    return {
      success: true,
      message: 'OTP verified successfully. Order marked as delivered.',
    };
  } catch (error: any) {
    console.error('Error verifying delivery OTP:', error);
    throw new Error(error.message || 'Failed to verify delivery OTP');
  }
}

