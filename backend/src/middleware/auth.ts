import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../services/jwtService';

export type AuthUserType = 'Admin' | 'Seller' | 'Customer' | 'Delivery';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authenticate user by verifying JWT token
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Authorization header must be in format: Bearer <token>',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = verifyToken(token);
      req.user = decoded;
      next();
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Invalid or expired token',
      });
      return;
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message,
    });
    return;
  }
};

/**
 * Authorize user by checking role (for Admin users)
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Required role: ' + roles.join(' or '),
      });
      return;
    }

    next();
  };
};

/**
 * Require specific user type(s)
 */
export const requireUserType = (...userTypes: AuthUserType[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!userTypes.includes(req.user.userType)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Required user type: ' + userTypes.join(' or '),
      });
      return;
    }

    next();
  };
};

/**
 * Check if the user is enabled (specific to Sellers)
 */
export const checkEnabled = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    next();
    return;
  }

  // Only apply to Sellers
  if (req.user.userType === 'Seller') {
    try {
      // Import Seller model dynamically to avoid circular dependencies if any
      const Seller = (await import('../models/Seller')).default;
      const seller = await Seller.findById(req.user.userId);

      if (seller && !seller.isEnabled) {
        // If disabled, block all write operations (POST, PUT, DELETE, PATCH)
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
          res.status(403).json({
            success: false,
            message: 'Your account is disabled. You can only view data but cannot perform any actions (Add/Update/Delete).',
          });
          return;
        }

        // Also block POS related routes for disabled sellers
        if (req.originalUrl.includes('/pos')) {
          res.status(403).json({
            success: false,
            message: 'Access denied. POS access is disabled for your account.',
          });
          return;
        }
      }
    } catch (error) {
      console.error('Error checking seller status:', error);
    }
  }

  next();
};

