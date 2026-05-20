/**
 * BrandingThemeContext — Centralized dynamic branding theme system.
 *
 * Separate from the existing ThemeContext (which handles category-based
 * customer header themes). This context manages the admin-controlled
 * platform branding with global + customer themes, localStorage caching,
 * and Socket.IO realtime sync.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  applyGlobalTheme,
  applyCustomerTheme,
  type GlobalTheme,
  type CustomerTheme,
} from "../utils/applyTheme";
import {
  fetchTheme,
  getCachedTheme,
  invalidateThemeCache,
  type ThemeResponse,
  type GlobalThemeData,
  type CustomerThemeData,
} from "../services/api/themeService";
import { io as socketIO, Socket } from "socket.io-client";
import { getSocketBaseURL } from "../services/api/config";

// ─── Context Type ───
interface BrandingThemeContextType {
  globalTheme: GlobalThemeData;
  customerTheme: CustomerThemeData;
  isLoading: boolean;
  error: string | null;
  refreshTheme: () => Promise<void>;
}

// ─── Fallback defaults (mirrors backend defaults) ───
const FALLBACK_GLOBAL: GlobalThemeData = {
  primary: "#2563eb",
  secondary: "#1e40af",
  accent: "#f59e0b",
  background: "#ffffff",
  sidebar: "#1e293b",
  navbar: "#1e293b",
  text: "#111827",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
};

const FALLBACK_CUSTOMER: CustomerThemeData = {
  primary: "#ef4444",
  secondary: "#dc2626",
  accent: "#f97316",
  background: "#ffffff",
  text: "#111827",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
};

const BrandingThemeContext = createContext<BrandingThemeContextType | undefined>(
  undefined
);

export const BrandingThemeProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  // Hydrate from cache instantly to prevent flash
  const cached = useMemo(() => getCachedTheme(), []);

  const [globalTheme, setGlobalTheme] = useState<GlobalThemeData>(
    cached?.globalTheme || FALLBACK_GLOBAL
  );
  const [customerTheme, setCustomerTheme] = useState<CustomerThemeData>(
    cached?.customerTheme || FALLBACK_CUSTOMER
  );
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // Apply CSS variables whenever theme changes
  useEffect(() => {
    applyGlobalTheme(globalTheme as GlobalTheme);
  }, [globalTheme]);

  useEffect(() => {
    applyCustomerTheme(customerTheme as CustomerTheme);
  }, [customerTheme]);

  // Fetch from backend
  const refreshTheme = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchTheme();
      setGlobalTheme(data.globalTheme);
      setCustomerTheme(data.customerTheme);
    } catch (err: any) {
      console.error("[BrandingTheme] Failed to fetch theme:", err);
      setError("Failed to load theme");
      // Keep cached/fallback values — don't break the UI
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch (behind cache if available)
  useEffect(() => {
    refreshTheme();
  }, [refreshTheme]);

  // ─── Socket.IO realtime theme sync ───
  useEffect(() => {
    try {
      const socketUrl = getSocketBaseURL();
      console.log("[BrandingTheme] Attempting socket connection to:", socketUrl);

      const socket = socketIO(socketUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 5,
        timeout: 5000, // 5 second connection timeout
        // No auth needed for theme events (broadcast to all)
      });

      socket.on("connect", () => {
        console.log("[BrandingTheme] Socket connected successfully");
      });

      socket.on("themeUpdated", (data: any) => {
        console.log("[BrandingTheme] Realtime theme update received:", data.type);

        if (data.globalTheme) {
          setGlobalTheme(data.globalTheme);
        }
        if (data.customerTheme) {
          setCustomerTheme(data.customerTheme);
        }

        // Invalidate cache so next page load fetches fresh
        invalidateThemeCache();
      });

      socket.on("connect_error", (err: any) => {
        console.warn("[BrandingTheme] Socket connection error:", err.message);
        // Don't break the app - themes will still load from API
      });

      socket.on("disconnect", (reason) => {
        console.log("[BrandingTheme] Socket disconnected:", reason);
      });

      socketRef.current = socket;
    } catch (err) {
      console.warn("[BrandingTheme] Failed to initialize socket:", err);
      // Silently fail - the theme will still work via HTTP API
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Refresh on tab focus
  useEffect(() => {
    const handleFocus = () => refreshTheme();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshTheme]);

  const value = useMemo(
    () => ({
      globalTheme,
      customerTheme,
      isLoading,
      error,
      refreshTheme,
    }),
    [globalTheme, customerTheme, isLoading, error, refreshTheme]
  );

  return (
    <BrandingThemeContext.Provider value={value}>
      {children}
    </BrandingThemeContext.Provider>
  );
};

/**
 * Hook to access branding theme data
 */
export const useBrandingTheme = (): BrandingThemeContextType => {
  const context = useContext(BrandingThemeContext);
  if (!context) {
    throw new Error(
      "useBrandingTheme must be used within a BrandingThemeProvider"
    );
  }
  return context;
};
