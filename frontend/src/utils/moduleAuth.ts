/**
 * Module-specific authentication token storage utility
 * Allows multiple modules (user, seller, delivery, admin) to maintain separate auth sessions
 */

export type ModuleType = 'user' | 'seller' | 'delivery' | 'admin';

/**
 * Get the token key for a specific module
 */
const getTokenKey = (module: ModuleType): string => {
  return `${module}_authToken`;
};

/**
 * Get the user data key for a specific module
 */
const getUserDataKey = (module: ModuleType): string => {
  return `${module}_userData`;
};

/**
 * Detect current module from URL path
 */
export const detectModuleFromPath = (path?: string): ModuleType => {
  // Use provided path or get from window if available
  const pathname = path || (typeof window !== 'undefined' ? window.location.pathname : '/');

  // Check if path starts with module prefix (with or without trailing slash)
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/seller')) return 'seller';
  if (pathname.startsWith('/delivery')) return 'delivery';
  return 'user';
};

/**
 * Set auth token for a specific module
 */
export const setModuleAuthToken = (token: string, module: ModuleType): void => {
  const key = getTokenKey(module);
  console.log(`🔑 Setting token for module "${module}" with key: ${key}`);
  localStorage.setItem(key, token);
};

/**
 * Get auth token for a specific module
 */
export const getModuleAuthToken = (module: ModuleType): string | null => {
  const key = getTokenKey(module);
  const token = localStorage.getItem(key);
  console.log(`🔑 Getting token for module "${module}" with key: ${key}`);
  return token;
};

/**
 * Remove auth token for a specific module
 */
export const removeModuleAuthToken = (module: ModuleType): void => {
  localStorage.removeItem(getTokenKey(module));
  localStorage.removeItem(getUserDataKey(module));
};

/**
 * Set user data for a specific module
 */
export const setModuleUserData = (userData: any, module: ModuleType): void => {
  localStorage.setItem(getUserDataKey(module), JSON.stringify(userData));
};

/**
 * Get user data for a specific module
 */
export const getModuleUserData = (module: ModuleType): any | null => {
  const data = localStorage.getItem(getUserDataKey(module));
  if (data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
  return null;
};

/**
 * Clear all auth data for a specific module
 */
export const clearModuleAuth = (module: ModuleType): void => {
  removeModuleAuthToken(module);
};

/**
 * Get current module's auth token based on current path
 */
export const getCurrentModuleToken = (): string | null => {
  const module = detectModuleFromPath();
  const token = getModuleAuthToken(module);
  console.log(`🎯 getCurrentModuleToken: module="${module}", hasToken=${!!token}`);
  return token;
};
