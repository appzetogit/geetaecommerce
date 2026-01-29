importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAo6FD-Bh5vEiI0oaSe4feDT8q4eD-ru68",
  authDomain: "geetaapp-57a53.firebaseapp.com",
  projectId: "geetaapp-57a53",
  storageBucket: "geetaapp-57a53.firebasestorage.app",
  messagingSenderId: "152190840467",
  appId: "1:152190840467:web:def415cac1aa6f93af6766",
  measurementId: "G-VGNEYX0SM3"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[SW-DEBUG] 📬 REAL-TIME: Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message',
    icon: '/notification-icon.png',
    tag: 'geeta-notification', // Must match App.tsx and Backend
    renotify: true, // Notify again if same tag exists
    data: payload.data
  };

  console.log('[SW-DEBUG] 🔔 Showing notification:', notificationTitle);
  return self.registration.showNotification(notificationTitle, notificationOptions);
});
