/**
 * Apply Theme — Injects CSS custom properties into the document root
 * Handles both global (admin/seller/delivery) and customer theme scopes.
 */

import { lighten, darken, withAlpha, getReadableTextColor } from "./colorUtils";

export interface GlobalTheme {
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

export interface CustomerTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  success: string;
  warning: string;
  danger: string;
}

/**
 * Apply the global platform theme as CSS custom properties on :root.
 * This affects Admin, Seller, and Delivery panels.
 */
export const applyGlobalTheme = (theme: GlobalTheme): void => {
  const root = document.documentElement;

  // Primary color + shades
  root.style.setProperty("--primary-color", theme.primary);
  root.style.setProperty("--primary-light", lighten(theme.primary, 15));
  root.style.setProperty("--primary-lighter", lighten(theme.primary, 30));
  root.style.setProperty("--primary-dark", darken(theme.primary, 10));
  root.style.setProperty("--primary-darker", darken(theme.primary, 20));
  root.style.setProperty("--primary-alpha-10", withAlpha(theme.primary, 0.1));
  root.style.setProperty("--primary-alpha-20", withAlpha(theme.primary, 0.2));
  root.style.setProperty("--primary-alpha-30", withAlpha(theme.primary, 0.3));
  root.style.setProperty("--primary-alpha-40", withAlpha(theme.primary, 0.4));
  root.style.setProperty("--primary-alpha-50", withAlpha(theme.primary, 0.5));

  // Secondary color
  root.style.setProperty("--secondary-color", theme.secondary);
  root.style.setProperty("--secondary-light", lighten(theme.secondary, 15));
  root.style.setProperty("--secondary-dark", darken(theme.secondary, 10));

  // Accent color
  root.style.setProperty("--accent-color", theme.accent);
  root.style.setProperty("--accent-light", lighten(theme.accent, 15));
  root.style.setProperty("--accent-dark", darken(theme.accent, 10));

  // Layout colors
  root.style.setProperty("--background-color", theme.background);
  root.style.setProperty("--sidebar-color", theme.sidebar);
  root.style.setProperty("--navbar-color", theme.navbar);
  root.style.setProperty("--text-color", theme.text);

  // Auto-computed text colors for sidebar/navbar backgrounds
  root.style.setProperty(
    "--sidebar-text-color",
    getReadableTextColor(theme.sidebar)
  );
  root.style.setProperty(
    "--navbar-text-color",
    getReadableTextColor(theme.navbar)
  );
  root.style.setProperty(
    "--primary-text-color",
    getReadableTextColor(theme.primary)
  );

  // Status colors
  root.style.setProperty("--success-color", theme.success);
  root.style.setProperty("--warning-color", theme.warning);
  root.style.setProperty("--danger-color", theme.danger);

  // Focus / ring
  root.style.setProperty("--focus-ring-color", withAlpha(theme.primary, 0.35));

  // Hover states
  root.style.setProperty("--hover-bg", withAlpha(theme.primary, 0.08));
  root.style.setProperty("--active-bg", withAlpha(theme.primary, 0.15));
};

/**
 * Apply the customer theme as CSS custom properties under --customer-* prefix.
 * These are scoped and isolated from the admin ecosystem.
 */
export const applyCustomerTheme = (theme: CustomerTheme): void => {
  const root = document.documentElement;

  // Primary + Shades
  root.style.setProperty("--customer-primary", theme.primary);
  root.style.setProperty("--customer-primary-light", lighten(theme.primary, 15));
  root.style.setProperty("--customer-primary-lighter", lighten(theme.primary, 30));
  root.style.setProperty("--customer-primary-dark", darken(theme.primary, 10));
  root.style.setProperty("--customer-primary-darker", darken(theme.primary, 20));

  // Alpha variants
  root.style.setProperty("--customer-primary-alpha-10", withAlpha(theme.primary, 0.1));
  root.style.setProperty("--customer-primary-alpha-20", withAlpha(theme.primary, 0.2));
  root.style.setProperty("--customer-primary-alpha-30", withAlpha(theme.primary, 0.3));
  root.style.setProperty("--customer-primary-alpha-40", withAlpha(theme.primary, 0.4));
  root.style.setProperty("--customer-primary-alpha-50", withAlpha(theme.primary, 0.5));

  // Other properties
  root.style.setProperty("--customer-secondary", theme.secondary);
  root.style.setProperty("--customer-accent", theme.accent);
  root.style.setProperty("--customer-background", theme.background);
  root.style.setProperty("--customer-text", theme.text);
  root.style.setProperty(
    "--customer-primary-text",
    getReadableTextColor(theme.primary)
  );

  root.style.setProperty("--customer-success", theme.success);
  root.style.setProperty("--customer-warning", theme.warning);
  root.style.setProperty("--customer-danger", theme.danger);
};

/**
 * Remove all theme CSS custom properties (cleanup)
 */
export const clearThemeVariables = (): void => {
  const root = document.documentElement;
  const properties = [
    "--primary-color",
    "--primary-light",
    "--primary-lighter",
    "--primary-dark",
    "--primary-darker",
    "--primary-alpha-10",
    "--primary-alpha-20",
    "--primary-alpha-30",
    "--primary-alpha-40",
    "--primary-alpha-50",
    "--secondary-color",
    "--secondary-light",
    "--secondary-dark",
    "--accent-color",
    "--accent-light",
    "--accent-dark",
    "--background-color",
    "--sidebar-color",
    "--navbar-color",
    "--text-color",
    "--sidebar-text-color",
    "--navbar-text-color",
    "--primary-text-color",
    "--success-color",
    "--warning-color",
    "--danger-color",
    "--focus-ring-color",
    "--hover-bg",
    "--active-bg",
    "--customer-primary",
    "--customer-primary-light",
    "--customer-primary-lighter",
    "--customer-primary-dark",
    "--customer-primary-darker",
    "--customer-primary-alpha-10",
    "--customer-primary-alpha-20",
    "--customer-primary-alpha-30",
    "--customer-primary-alpha-40",
    "--customer-primary-alpha-50",
    "--customer-secondary",
    "--customer-accent",
    "--customer-background",
    "--customer-text",
    "--customer-primary-text",
    "--customer-success",
    "--customer-warning",
    "--customer-danger",
  ];
  properties.forEach((prop) => root.style.removeProperty(prop));
};
