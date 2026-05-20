import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import {
  detectModuleFromPath,
  getCurrentModuleToken,
  setModuleAuthToken,
  removeModuleAuthToken,
} from "../../utils/moduleAuth";

// Base API URL - adjust based on your backend URL
// In development, use relative URL to leverage Vite proxy
// In production, use full URL or environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? "/api/v1" : "https://api.geeta.today/api/v1");

// Log API configuration on startup (only in development)
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', {
    API_BASE_URL,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'not set (using relative path for proxy)',
    NODE_ENV: import.meta.env.MODE,
    'Note': 'Using Vite proxy. Ensure backend is running on http://localhost:5000'
  });
}

// Socket.io base URL - extract from API_BASE_URL by removing /api/v1
// Socket connections need the base server URL without the API path
export const getSocketBaseURL = (): string => {
  // Use VITE_API_URL if explicitly set (for socket connections)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // In development, use localhost:5000 directly (since Vite proxy doesn't work for WebSockets)
  if (import.meta.DEV) {
    return "http://localhost:5000";
  }

  // In production, use the production API URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "https://api.geeta.today/api/v1";

  // Remove /api/v1 or /api from the end
  const socketUrl = apiBaseUrl.replace(/\/api\/v\d+$|\/api$/, '');

  return socketUrl || "https://api.geeta.today";
};

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add token to requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getCurrentModuleToken();

    // Ensure URL doesn't start with a slash when using baseURL with a path
    // This prevents axios from replacing the path part of baseURL (like /api/v1)
    if (config.url?.startsWith('/')) {
      config.url = config.url.substring(1);
    }

    console.log('🌐 API Request:', {
      url: config.url,
      fullUrl: config.baseURL ? `${config.baseURL}/${config.url}` : config.url,
      method: config.method,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : null,
      currentPath: window.location.pathname
    });

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Token attached to request');
    } else {
      console.warn('⚠️ No token available for request');
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: any) => {
    // Keep session persistent across refreshes and transient API failures.
    // Do not auto-clear token or force-redirect on 401; only explicit logout should clear auth.
    if (error.response?.status === 401) {
      console.warn("⚠️ Received 401 response. Keeping session intact (manual logout only).");
    }
    return Promise.reject(error);
  }
);

// Token management helpers
export const setAuthToken = (token: string) => {
  const module = detectModuleFromPath();
  console.log(`📍 setAuthToken called - Current path: ${window.location.pathname}, Detected module: ${module}`);
  setModuleAuthToken(token, module);
};

export const getAuthToken = (): string | null => {
  return getCurrentModuleToken();
};

export const removeAuthToken = () => {
  const module = detectModuleFromPath();
  removeModuleAuthToken(module);
};

export default api;
