import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import {
  detectModuleFromPath,
  getCurrentModuleToken,
  setModuleAuthToken,
  removeModuleAuthToken,
  ModuleType
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

  // Otherwise, extract base URL from VITE_API_BASE_URL
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
    // Only handle 401 (Unauthorized) for auto-logout
    // 403 (Forbidden) means user is authenticated but doesn't have permission - DO NOT LOGOUT
    if (error.response?.status === 401) {
      // Check if this is an authentication endpoint (OTP verification, etc.)
      // Don't redirect for auth endpoints - let the component handle the error
      const isAuthEndpoint = error.config?.url?.includes("/auth/");

      // Check if there was a token in the request (meaning user was logged in)
      const hadToken = error.config?.headers?.Authorization;

      // Only redirect if:
      // 1. It's not an auth endpoint
      // 2. There was a token in the request (user was logged in but token expired)
      // 3. User is not already on login/signup pages
      // 4. Request is not explicitly marked to skip auth redirect
      if (!isAuthEndpoint && hadToken && !(error.config as any).skipAuthRedirect) {
        const currentPath = window.location.pathname;

        // Skip redirect if already on public auth pages (login/signup)
        if (currentPath.includes("/login") || currentPath.includes("/signup")) {
          return Promise.reject(error);
        }

        // Token expired or invalid - clear token and redirect to appropriate login
        // STRICTLY check path to ensure correct redirect
        const path = currentPath.toLowerCase();

        let redirectPath = "/login";
        let module: ModuleType = 'user';

        if (path.startsWith('/admin') || path.includes('/admin/')) {
          redirectPath = "/admin/login";
          module = 'admin';
        } else if (path.startsWith('/seller') || path.includes('/seller/')) {
          redirectPath = "/seller/login";
          module = 'seller';
        } else if (path.startsWith('/delivery') || path.includes('/delivery/')) {
          redirectPath = "/delivery/login";
          module = 'delivery';
        }

        console.log(`🔒 Auth Error (401) on ${currentPath} -> Redirecting to ${redirectPath} (Module: ${module})`);

        removeModuleAuthToken(module);
        window.location.href = redirectPath;
      }
      // If no token was present, user is just browsing as guest - don't redirect
      // Just reject the promise so the component can handle it gracefully
    }
    // For 403 and other errors, just reject the promise so the UI can handle it
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
