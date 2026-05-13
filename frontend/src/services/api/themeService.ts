/**
 * Theme API Service
 * Handles all communication with the backend theme endpoints.
 */

import api from "./config";

export interface GlobalThemeData {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  sidebar: string;
  navbar: string;
  text: string;
  success: string;
  warning: string;
  danger: string;
}

export interface CustomerThemeData {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  success: string;
  warning: string;
  danger: string;
}

export interface ThemeResponse {
  globalTheme: GlobalThemeData;
  customerTheme: CustomerThemeData;
  darkMode?: { enabled: boolean; auto: boolean };
}

export interface FullThemeResponse extends ThemeResponse {
  themeHistory: Array<{
    globalTheme: GlobalThemeData;
    customerTheme: CustomerThemeData;
    changedAt: string;
    changedBy?: string;
  }>;
  scheduledTheme?: {
    globalTheme?: GlobalThemeData;
    customerTheme?: CustomerThemeData;
    activateAt: string;
    active: boolean;
  };
  updatedAt: string;
  updatedBy?: string;
}

// ─── localStorage cache key ───
const THEME_CACHE_KEY = "geeta_theme_cache";
const THEME_CACHE_TIMESTAMP = "geeta_theme_cache_ts";

/**
 * Get cached theme from localStorage (returns null if expired or missing)
 */
export const getCachedTheme = (): ThemeResponse | null => {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    const ts = localStorage.getItem(THEME_CACHE_TIMESTAMP);
    if (!cached || !ts) return null;

    // Cache valid for 5 minutes
    const elapsed = Date.now() - parseInt(ts, 10);
    if (elapsed > 5 * 60 * 1000) return null;

    return JSON.parse(cached);
  } catch {
    return null;
  }
};

/**
 * Save theme to localStorage cache
 */
const cacheTheme = (data: ThemeResponse): void => {
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(THEME_CACHE_TIMESTAMP, Date.now().toString());
  } catch {
    // localStorage might be full or unavailable
  }
};

/**
 * Invalidate the local theme cache
 */
export const invalidateThemeCache = (): void => {
  try {
    localStorage.removeItem(THEME_CACHE_KEY);
    localStorage.removeItem(THEME_CACHE_TIMESTAMP);
  } catch {
    // noop
  }
};

// ─── API calls ───

/**
 * GET /api/v1/theme — Public, returns global + customer theme
 */
export const fetchTheme = async (): Promise<ThemeResponse> => {
  const response = await api.get("theme");
  const data = response.data.data as ThemeResponse;
  cacheTheme(data);
  return data;
};

/**
 * GET /api/v1/theme/admin — Admin only, includes history
 */
export const fetchFullThemeSettings = async (): Promise<FullThemeResponse> => {
  const response = await api.get("theme/admin");
  return response.data.data as FullThemeResponse;
};

/**
 * PUT /api/v1/theme/global — Admin only
 */
export const updateGlobalTheme = async (
  theme: Partial<GlobalThemeData>
): Promise<ThemeResponse> => {
  const response = await api.put("theme/global", theme);
  const data = response.data.data as ThemeResponse;
  invalidateThemeCache();
  return data;
};

/**
 * PUT /api/v1/theme/customer — Admin only
 */
export const updateCustomerTheme = async (
  theme: Partial<CustomerThemeData>
): Promise<ThemeResponse> => {
  const response = await api.put("theme/customer", theme);
  const data = response.data.data as ThemeResponse;
  invalidateThemeCache();
  return data;
};

/**
 * POST /api/v1/theme/reset — Admin only
 */
export const resetTheme = async (): Promise<ThemeResponse> => {
  const response = await api.post("theme/reset");
  const data = response.data.data as ThemeResponse;
  invalidateThemeCache();
  return data;
};

/**
 * POST /api/v1/theme/import — Admin only
 */
export const importTheme = async (payload: {
  globalTheme?: Partial<GlobalThemeData>;
  customerTheme?: Partial<CustomerThemeData>;
}): Promise<ThemeResponse> => {
  const response = await api.post("theme/import", payload);
  const data = response.data.data as ThemeResponse;
  invalidateThemeCache();
  return data;
};

/**
 * POST /api/v1/theme/restore/:index — Admin only
 */
export const restoreThemeFromHistory = async (
  index: number
): Promise<ThemeResponse> => {
  const response = await api.post(`theme/restore/${index}`);
  const data = response.data.data as ThemeResponse;
  invalidateThemeCache();
  return data;
};

/**
 * PUT /api/v1/theme/dark-mode — Admin only
 */
export const updateDarkMode = async (settings: {
  enabled?: boolean;
  auto?: boolean;
}): Promise<{ darkMode: { enabled: boolean; auto: boolean } }> => {
  const response = await api.put("theme/dark-mode", settings);
  return response.data.data;
};
