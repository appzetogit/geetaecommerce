import admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const serviceAccountPath = path.resolve(process.cwd(), 'config/firebase-service-account.json');

console.log('Firebase Admin: Initialization sequence started');
console.log('Firebase Admin: Current working directory:', process.cwd());
console.log('Firebase Admin: Service account path:', serviceAccountPath);

// Check if already initialized
try {
  if (!admin.apps.length) {
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('❌ Firebase Service Account file not found at:', serviceAccountPath);
      throw new Error(`Service account file missing at ${serviceAccountPath}`);
    }

    console.log('Firebase Admin: Loading config from', serviceAccountPath);
    const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(fileContent);

    console.log('Firebase Admin: Project ID:', serviceAccount.project_id);
    console.log('Firebase Admin: Client Email:', serviceAccount.client_email);

    // Ensure the private key is properly formatted (common fix for JWT issues)
    if (serviceAccount.private_key) {
      const originalKey = serviceAccount.private_key;
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      if (originalKey !== serviceAccount.private_key) {
        console.log('Firebase Admin: Private key was reformatted (literal \\n replaced)');
      } else {
        console.log('Firebase Admin: Private key format looks correct (already has newlines or no literal \\n found)');
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin Initialized successfully');

    // Async health check
    admin.app().options.credential?.getAccessToken()
      .then(() => console.log('✅ Firebase Auth Check: Credentials are valid and token fetched.'))
      .catch((err: any) => {
        console.error('❌ Firebase Auth Check failed: Invalid Credentials or System Time.');
        console.error('   Error Code:', err.code);
        console.error('   Error Message:', err.message);
      });

  } else {
    console.log('Firebase Admin: Already initialized (apps length:', admin.apps.length, ')');
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
