import { Request, Response, NextFunction } from "express";

// Strict hex color regex
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Validate that a value is a valid hex color
 */
const isValidHexColor = (value: string): boolean => {
  return typeof value === "string" && HEX_COLOR_REGEX.test(value.trim());
};

/**
 * Sanitize a hex color string to prevent CSS injection
 * - Strips anything that's not a hex character or #
 * - Normalizes to lowercase
 */
const sanitizeHexColor = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  // Only allow # followed by valid hex characters
  const match = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!match) {
    throw new Error(`Invalid hex color: ${value}`);
  }
  return `#${match[1]}`;
};

/**
 * Global theme fields expected
 */
const GLOBAL_THEME_FIELDS = [
  "primary",
  "secondary",
  "accent",
  "background",
  "sidebar",
  "navbar",
  "text",
  "success",
  "warning",
  "danger",
];

/**
 * Customer theme fields expected
 */
const CUSTOMER_THEME_FIELDS = [
  "primary",
  "secondary",
  "accent",
  "background",
  "text",
  "success",
  "warning",
  "danger",
];

/**
 * Middleware: Validate and sanitize global theme payload
 */
export const validateGlobalTheme = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const theme = req.body;

    if (!theme || typeof theme !== "object") {
      res.status(400).json({
        success: false,
        message: "Theme data is required",
      });
      return;
    }

    const sanitized: Record<string, string> = {};
    const errors: string[] = [];

    for (const field of GLOBAL_THEME_FIELDS) {
      if (theme[field] !== undefined) {
        if (!isValidHexColor(theme[field])) {
          errors.push(`Invalid color for "${field}": ${theme[field]}`);
        } else {
          sanitized[field] = sanitizeHexColor(theme[field]);
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: "Invalid theme colors",
        errors,
      });
      return;
    }

    // Replace body with sanitized values only (strip any extra fields)
    req.body = sanitized;
    next();
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Theme validation failed",
    });
  }
};

/**
 * Middleware: Validate and sanitize customer theme payload
 */
export const validateCustomerTheme = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const theme = req.body;

    if (!theme || typeof theme !== "object") {
      res.status(400).json({
        success: false,
        message: "Theme data is required",
      });
      return;
    }

    const sanitized: Record<string, string> = {};
    const errors: string[] = [];

    for (const field of CUSTOMER_THEME_FIELDS) {
      if (theme[field] !== undefined) {
        if (!isValidHexColor(theme[field])) {
          errors.push(`Invalid color for "${field}": ${theme[field]}`);
        } else {
          sanitized[field] = sanitizeHexColor(theme[field]);
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: "Invalid theme colors",
        errors,
      });
      return;
    }

    req.body = sanitized;
    next();
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Theme validation failed",
    });
  }
};
