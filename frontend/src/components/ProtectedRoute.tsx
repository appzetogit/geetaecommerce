import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { detectModuleFromPath, getModuleAuthToken, getModuleUserData } from "../utils/moduleAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredUserType?: "Admin" | "Seller" | "Customer" | "Delivery";
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredUserType,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const location = useLocation();

  // Detect which module we're in based on the current path
  let currentModule = detectModuleFromPath(location.pathname);

  // Double check module detection for admin routes
  if (currentModule === 'user' && (location.pathname.startsWith('/admin') || location.pathname.includes('/admin/'))) {
    currentModule = 'admin';
  }

  // Check if user is authenticated for THIS specific module
  const moduleToken = getModuleAuthToken(currentModule);
  const moduleUser = getModuleUserData(currentModule);
  const isModuleAuthenticated = !!(moduleToken && moduleUser);

  console.log('🔒 ProtectedRoute Check:', {
    path: location.pathname,
    currentModule,
    hasModuleToken: !!moduleToken,
    hasModuleUser: !!moduleUser,
    isModuleAuthenticated,
    requiredUserType,
    redirectTo
  });

  // Check authentication for THIS module
  if (!isModuleAuthenticated || !moduleToken) {
    console.log('❌ Not authenticated for module:', currentModule, '→ Redirecting to:', redirectTo);
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check user type if required
  if (requiredUserType && moduleUser) {
    // Check userType or role field
    // Admin users have role: "Admin" or "Super Admin"
    // For Admin userType check, we need to verify the user is an admin
    const userType = moduleUser.userType || moduleUser.role;

    console.log('🔍 Checking user type:', { userType, requiredUserType });

    // For Admin routes, check if role is "Admin" or "Super Admin"
    if (requiredUserType === "Admin") {
      const isAdmin = userType === "Admin" || userType === "Super Admin";
      if (!isAdmin) {
        console.log('❌ Not admin → Redirecting to:', redirectTo);
        return <Navigate to={redirectTo} replace />;
      }
    } else if (userType && userType !== requiredUserType) {
      console.log('❌ User type mismatch → Redirecting to:', redirectTo);
      return <Navigate to={redirectTo} replace />;
    }
  }

  // Check role if required (for Admin users)
  if (requiredRole && moduleUser) {
    const userRole = moduleUser.role;
    if (!userRole || userRole !== requiredRole) {
      console.log('❌ Role mismatch → Redirecting to:', redirectTo);
      return <Navigate to={redirectTo} replace />;
    }
  }

  console.log('✅ Access granted');
  return <>{children}</>;
}
