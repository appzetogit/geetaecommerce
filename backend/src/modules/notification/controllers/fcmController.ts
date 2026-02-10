import { NextFunction, Request, Response } from 'express';
import Customer from '../../../models/Customer';
import Delivery from '../../../models/Delivery';
import Seller from '../../../models/Seller';
import Admin from '../../../models/Admin';
import { sendPushNotification } from '../../../services/firebaseAdmin';

export const saveFCMToken = async (req: Request, res: Response, next: NextFunction) => {
  console.log('📥 [BACKEND] Received saveFCMToken request');
  try {
    const { token, platform, userType } = req.body;
    const userId = req.user?.userId;

    console.log('📋 [BACKEND] Payload:', {
      token: token ? (token.substring(0, 10) + '...') : 'MISSING',
      platform,
      userType,
      userId
    });

    if (!token || !userId || !userType) {
      console.error('❌ [BACKEND] Missing required fields:', { token: !!token, userId: !!userId, userType: !!userType });
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    let Model: any;
    if (userType === 'customer') Model = Customer;
    else if (userType === 'delivery') Model = Delivery;
    else if (userType === 'seller') Model = Seller;
    else if (userType === 'admin') Model = Admin;
    else {
      console.error('❌ [BACKEND] Invalid user type:', userType);
      return res.status(400).json({ success: false, message: 'Invalid user type' });
    }

    const allowedPlatforms = ['web', 'app', 'android', 'ios'];
    if (platform && !allowedPlatforms.includes(platform)) {
      return res.status(400).json({ success: false, message: 'Invalid platform' });
    }

    // Default to 'web' if not specified, or validate strictly if required
    // Mapping: 'web' -> fcmToken, others ('app', 'android', 'ios') -> fcmTokenMobile
    const isMobile = ['app', 'android', 'ios'].includes(platform);
    const updateField = isMobile ? { fcmTokenMobile: token } : { fcmToken: token };
    console.log(`💾 [BACKEND] Updating ${userType} (${userId}) with ${platform} token`);

    const updatedUser = await Model.findByIdAndUpdate(userId, updateField, { new: true });

    if (!updatedUser) {
      console.error('❌ [BACKEND] User not found in database:', userId);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('✅ [BACKEND] FCM token saved successfully in DB');
    res.status(200).json({ success: true, message: 'FCM token saved successfully' });
  } catch (error) {
    console.error('🔥 [BACKEND] Error in saveFCMToken:', error);
    next(error);
  }
};

export const sendNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, tokens, userIds, userType, title, body, data, imageUrl, platform } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and Body are required' });
    }

    // 1. Direct Token Mode (Simplified API)
    if (token || (tokens && tokens.length > 0)) {
       const targetTokens: string[] = tokens || (Array.isArray(token) ? token : [token]);

       if (targetTokens.length === 0) {
          return res.status(400).json({ success: false, message: 'Token is required' });
       }

       console.log(`[FCM-DEBUG] 📨 Sending to direct tokens: ${targetTokens.length}`);
       const result: any = await sendPushNotification(targetTokens, { title, body, data, imageUrl });
       console.log(`[FCM-DEBUG] ✅ Sent result:`, JSON.stringify(result));

       return res.status(200).json({
         success: true,
         message: 'Notification sent successfully',
         successCount: result?.successCount,
         failureCount: result?.failureCount
       });
    }

    // 2. User Target Mode (Advanced API - Fallback)
    if (userIds && Array.isArray(userIds) && userType) {
        let Model: any;
        if (userType === 'customer') Model = Customer;
        else if (userType === 'delivery') Model = Delivery;
        else if (userType === 'seller') Model = Seller;
        else if (userType === 'admin') Model = Admin;
        else return res.status(400).json({ success: false, message: 'Invalid user type' });

        const users = await Model.find({ _id: { $in: userIds } }).select('fcmToken fcmTokenMobile mobile phone');

        const dbTokensSet = new Set<string>();
        users.forEach((user: any) => {
          // If the user has both mobile and web tokens, prefer mobile to avoid double notifications on same device
          if (user.fcmTokenMobile) {
            dbTokensSet.add(user.fcmTokenMobile);
          } else if (user.fcmToken) {
            dbTokensSet.add(user.fcmToken);
          }
        });
        const dbTokens = Array.from(dbTokensSet);

        if (dbTokens.length === 0) {
          return res.status(200).json({ success: true, message: 'No registered devices found for these users' });
        }

        console.log(`[FCM-DEBUG] 📨 Sending to ${dbTokens.length} DB tokens for users: ${userIds.join(', ')}`);
        const result = await sendPushNotification(dbTokens, { title, body, data, imageUrl });
        console.log(`[FCM-DEBUG] ✅ Sent result:`, JSON.stringify(result));
        return res.status(200).json({
          success: true,
          message: `Notification sent to ${dbTokens.length} devices`,
          successCount: result?.successCount,
          failureCount: result?.failureCount
        });
    }

    // If neither mode is satisfied
    return res.status(400).json({ success: false, message: 'Invalid payload. Provide "token" OR "userIds" + "userType".' });

  } catch (error) {
    next(error);
  }
};
