import { messaging, getToken, onMessage } from '../firebase';
import axios from 'axios';

const VAPID_KEY = "BBIaDZbFoNRN0wCbCsg9zDgfSIbH94G77houhAZawsYOZxCzkLhMa-hPTzUDbAHIRPaf2o92d1uUa8ZwNtZQu7w";

export const requestNotificationPermission = async (userType: 'customer' | 'delivery' | 'seller' | 'admin', authToken?: string) => {
  console.log(`[FCM-DEBUG] 🚀 STEP 1: requestNotificationPermission started for ${userType}`);

  if (!('Notification' in window)) {
    console.error('[FCM-DEBUG] ❌ Browser does not support notifications');
    return null;
  }

  try {
    console.log('[FCM-DEBUG] 🔔 STEP 2: Requesting browser permission...');
    const permission = await Notification.requestPermission();
    console.log(`[FCM-DEBUG] 📋 STEP 3: Permission status: ${permission}`);

    if (permission === 'granted') {
      console.log('[FCM-DEBUG] ✨ STEP 4: Permission GRANTED. Checking for Service Worker...');

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (registration) {
          console.log('[FCM-DEBUG] 📥 STEP 5: Service Worker already registered:', registration.scope);
        } else {
          console.log('[FCM-DEBUG] 📥 STEP 5: Registering new Service Worker...');
          await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        }
      }

      console.log('[FCM-DEBUG] 🔑 STEP 6: Fetching token from Firebase...');
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });

      if (token) {
        console.log('[FCM-DEBUG] ✅ STEP 7: FCM Token generated successfully:', token);
        await saveTokenToBackend(token, userType, authToken);
        return token;
      } else {
        console.warn('[FCM-DEBUG] ⚠️ STEP 7: No FCM token received from Firebase. Check VAPID key or network.');
      }
    } else {
      console.warn('[FCM-DEBUG] ❌ STEP 3: Notification permission DENIED by user.');
    }
  } catch (error) {
    console.error('[FCM-DEBUG] 🔥 FATAL ERROR in requestNotificationPermission:', error);
  }
};

const saveTokenToBackend = async (token: string, userType: string, authTokenOverride?: string) => {
  console.log(`[FCM-DEBUG] 📤 STEP 7: Preparing to save token to backend for ${userType}...`);
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

    // Auth Token detection logic
    const authToken = authTokenOverride ||
                      localStorage.getItem('token') ||
                      localStorage.getItem('user_authToken') ||
                      localStorage.getItem('seller_authToken') ||
                      localStorage.getItem('delivery_authToken') ||
                      localStorage.getItem('admin_authToken');

    if (!authToken) {
      console.error('[FCM-DEBUG] ❌ STEP 8: FAILED - Auth token not found in override or localStorage. Backend will reject this.');
      return;
    }

    const payload = {
      token,
      platform: 'web',
      userType
    };

    console.log('[FCM-DEBUG] 📡 STEP 9: Sending POST request to:', `${API_URL}/notification/save-token`, 'with payload:', payload);
    const response = await axios.post(`${API_URL}/notification/save-token`, payload, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    if (response.data.success) {
      console.log('[FCM-DEBUG] 🎉 STEP 10: SUCCESS! FCM token is now in Database.');
    } else {
      console.error('[FCM-DEBUG] ❌ STEP 10: Backend returned success:false:', response.data.message);
    }
  } catch (error: any) {
    console.error('[FCM-DEBUG] ❌ STEP 10: API ERROR:', error.response?.data || error.message);
  }
};

export const onMessageListener = (callback: (payload: any) => void) => {
  console.log('[FCM-DEBUG] 👂 Foreground listener attached');
  return onMessage(messaging, (payload) => {
    console.log('[FCM-DEBUG] 📬 REAL-TIME: Foreground message received:', {
      title: payload.notification?.title,
      body: payload.notification?.body,
      data: payload.data
    });
    callback(payload);
  });
};
