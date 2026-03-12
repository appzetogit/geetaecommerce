import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { detectModuleFromPath, getModuleAuthToken, getModuleUserData } from "../utils/moduleAuth";
import { canStaffAccessPath, getStaffSession, StaffModule } from "../utils/staffSession";

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

  let currentModule = detectModuleFromPath(location.pathname);

  if (currentModule === "user" && (location.pathname.startsWith("/admin") || location.pathname.includes("/admin/"))) {
    currentModule = "admin";
  }

  const moduleToken = getModuleAuthToken(currentModule);
  const moduleUser = getModuleUserData(currentModule);
  const isModuleAuthenticated = !!(moduleToken && moduleUser);
  const staffSession =
    currentModule === "admin" || currentModule === "seller"
      ? getStaffSession(currentModule as StaffModule)
      : null;

  if (
    staffSession &&
    !canStaffAccessPath(
      currentModule as StaffModule,
      location.pathname,
      staffSession.permissions
    )
  ) {
    return <Navigate to={`/${currentModule}/pos/orders`} replace />;
  }

  if (!isModuleAuthenticated || !moduleToken) {
    if (staffSession && (requiredUserType === "Admin" || requiredUserType === "Seller")) {
      return <Navigate to={`/${currentModule}/staff-login`} replace />;
    }

    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (requiredUserType && moduleUser) {
    const userType = moduleUser.userType || moduleUser.role;

    if (requiredUserType === "Admin") {
      const isAdmin = userType === "Admin" || userType === "Super Admin";
      if (!isAdmin) {
        return <Navigate to={redirectTo} replace />;
      }
    } else if (userType && userType !== requiredUserType) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  if (requiredRole && moduleUser) {
    const userRole = moduleUser.role;
    if (!userRole || userRole !== requiredRole) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  return <>{children}</>;
}
