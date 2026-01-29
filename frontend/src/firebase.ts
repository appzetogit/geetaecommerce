import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAo6FD-Bh5vEiI0oaSe4feDT8q4eD-ru68",
  authDomain: "geetaapp-57a53.firebaseapp.com",
  projectId: "geetaapp-57a53",
  storageBucket: "geetaapp-57a53.firebasestorage.app",
  messagingSenderId: "152190840467",
  appId: "1:152190840467:web:def415cac1aa6f93af6766",
  measurementId: "G-VGNEYX0SM3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
console.log('[FCM-DEBUG] Firebase Messaging Initialized');

export { messaging, getToken, onMessage };
