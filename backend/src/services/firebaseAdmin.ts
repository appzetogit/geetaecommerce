import admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const serviceAccountPath = path.resolve(process.cwd(), 'config/firebase-service-account.json');

// Check if already initialized
try {
  if (!admin.apps.length) {
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('❌ Firebase Service Account file not found at:', serviceAccountPath);
      throw new Error(`Service account file missing at ${serviceAccountPath}`);
    }

    console.log('Firebase Admin: Loading config from', serviceAccountPath);
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    // Ensure the private key is properly formatted (common fix for JWT issues)
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin Initialized successfully');
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error);
}

export const sendPushNotification = async (tokens: string[], payload: any) => {
  try {
    if (!tokens || tokens.length === 0) return;

    // Remove duplicates and invalid tokens
    const uniqueTokens = [...new Set(tokens)].filter(t => t && t.length > 10);

    if (uniqueTokens.length === 0) return;

    // Ensure all data values are strings (FCM requirement)
    const sanitizedData: { [key: string]: string } = {};
    if (payload.data && typeof payload.data === 'object') {
      Object.keys(payload.data).forEach(key => {
        const value = payload.data[key];
        if (value !== undefined && value !== null) {
          sanitizedData[key] = String(value);
        }
      });
    }

    const message: any = {
      notification: {
        title: String(payload.title || ''),
        body: String(payload.body || ''),
      },
      data: sanitizedData,
      tokens: uniqueTokens,
      webpush: {
        notification: {
          title: String(payload.title || ''),
          body: String(payload.body || ''),
          icon: '/notification-icon.png',
          tag: 'geeta-notification',
          requireInteraction: true,
        },
        fcmOptions: {
          link: payload.data?.url || payload.data?.link || '/'
        }
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'high',
          channelId: 'default',
        }
      }
    };

    if (payload.imageUrl) {
      message.notification.imageUrl = String(payload.imageUrl);
    }

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM-SERVICE] 🚀 Successfully dispatched: ${response.successCount} messages`);
    console.log(`[FCM-SERVICE] ⚠️ Failed to dispatch: ${response.failureCount} messages`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[FCM-SERVICE] ❌ Error for token [${uniqueTokens[idx].substring(0, 10)}...]:`, resp.error);
        }
      });
    }

    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};

export default admin;
