import { Navigate, Outlet, useLocation } from "react-router-dom";
import { detectModuleFromPath, getModuleAuthToken, getModuleUserData } from "../utils/moduleAuth";

interface PublicRouteProps {
    children?: React.ReactNode;
    userType?: 'Admin' | 'Seller' | 'Customer' | 'Delivery';
}

export default function PublicRoute({ children, userType: allowedUserType }: PublicRouteProps) {
    const location = useLocation();

    // Detect which module we're in based on the current path
    const currentModule = detectModuleFromPath(location.pathname);

    // Check if user is authenticated for THIS specific module
    const moduleToken = getModuleAuthToken(currentModule);
    const moduleUser = getModuleUserData(currentModule);
    const isModuleAuthenticated = !!(moduleToken && moduleUser);

    console.log('🔍 PublicRoute Check:', {
        path: location.pathname,
        currentModule,
        hasModuleToken: !!moduleToken,
        hasModuleUser: !!moduleUser,
        isModuleAuthenticated,
        moduleUserType: moduleUser?.userType || moduleUser?.role,
        allowedUserType
    });

    if (isModuleAuthenticated && moduleUser) {
        // User is logged in to THIS module - redirect to their dashboard
        const currentUserType = moduleUser.userType || moduleUser.role;

        console.log('✅ User authenticated for module:', currentModule, 'UserType:', currentUserType);

        // If an allowedUserType is specified (e.g., 'Seller' for SellerLogin),
        // ONLY redirect if the logged-in user matches that type.
        // This allows a logged-in 'Customer' to see the 'Seller' login page.
        if (allowedUserType && currentUserType !== allowedUserType) {
            console.log('⏭️ Allowing access - user type mismatch');
            return children ? <>{children}</> : <Outlet />;
        }

        if (currentUserType === 'Admin' || currentUserType === 'Super Admin') {
            console.log('🔄 Redirecting to /admin');
            return <Navigate to="/admin" replace />;
        }

        if (currentUserType === 'Seller') {
            console.log('🔄 Redirecting to /seller');
            return <Navigate to="/seller" replace />;
        }

        if (currentUserType === 'Delivery') {
            console.log('🔄 Redirecting to /delivery');
            return <Navigate to="/delivery" replace />;
        }

        // Default for Customer
        console.log('🔄 Redirecting to /');
        return <Navigate to="/" replace />;
    }

    console.log('✅ No module auth - showing public route');
    return children ? <>{children}</> : <Outlet />;
}
