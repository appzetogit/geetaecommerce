import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useLayoutEffect,
} from "react";
import {
  setAuthToken,
  removeAuthToken,
} from "../services/api/config";
import {
  detectModuleFromPath,
  setModuleUserData,
  removeModuleAuthToken,
  getModuleAuthToken,
  getModuleUserData,
} from "../utils/moduleAuth";
import { clearStaffSession } from "../utils/staffSession";

export interface User {
  id: string;
  userType?: "Admin" | "Seller" | "Customer" | "Delivery" | "Super Admin";
  [key: string]: any;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize state from local storage to persist session across refreshes
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const module = detectModuleFromPath();
    const token = getModuleAuthToken(module);
    const user = getModuleUserData(module);
    return !!(token && user);
  });

  const [user, setUser] = useState<User | null>(() => {
    const module = detectModuleFromPath();
    return getModuleUserData(module);
  });

  const [token, setToken] = useState<string | null>(() => {
    const module = detectModuleFromPath();
    return getModuleAuthToken(module);
  });

  // Sync axios token header whenever token changes
  // Use useLayoutEffect to ensure token is set before any child components' effects run
  useLayoutEffect(() => {
    if (token) {
      setAuthToken(token);
    } else {
      removeAuthToken();
    }
  }, [token]);

  const login = (newToken: string, userData: User) => {
    const module = detectModuleFromPath();
    setToken(newToken);
    setUser(userData);
    setIsAuthenticated(true);
    setModuleUserData(userData, module);
    // Explicitly set token in localStorage immediately to avoid race conditions
    // where navigation happens before the useEffect runs
    setAuthToken(newToken);

    // Keep a last-known module auth snapshot for frontend-only staff mode.
    if (module === "admin" || module === "seller") {
      localStorage.setItem(`${module}_staff_base_token`, newToken);
      localStorage.setItem(`${module}_staff_base_user`, JSON.stringify(userData));
      clearStaffSession(module);
    }
  };

  const logout = () => {
    const module = detectModuleFromPath();
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    removeModuleAuthToken(module);
    if (module === "admin" || module === "seller") {
      clearStaffSession(module);
    }
    // setAuthToken handled by effect
  };

  const updateUser = (userData: User) => {
    const module = detectModuleFromPath();
    setUser(userData);
    setModuleUserData(userData, module);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        token,
        login,
        logout,
        updateUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
