/**
 * ThemedBadge — Badge/tag that consumes CSS theme variables.
 */
import React from "react";
import { withAlpha } from "../../utils/colorUtils";

type BadgeVariant = "primary" | "secondary" | "success" | "warning" | "danger" | "accent";

interface Props {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: React.CSSProperties;
}

const variantMap: Record<BadgeVariant, { bg: string; color: string }> = {
  primary: { bg: "var(--primary-alpha-10, rgba(37,99,235,0.1))", color: "var(--primary-color, #2563eb)" },
  secondary: { bg: "rgba(30,64,175,0.1)", color: "var(--secondary-color, #1e40af)" },
  success: { bg: "rgba(16,185,129,0.1)", color: "var(--success-color, #10b981)" },
  warning: { bg: "rgba(245,158,11,0.1)", color: "var(--warning-color, #f59e0b)" },
  danger: { bg: "rgba(239,68,68,0.1)", color: "var(--danger-color, var(--customer-primary))" },
  accent: { bg: "rgba(245,158,11,0.1)", color: "var(--accent-color, #f59e0b)" },
};

const ThemedBadge: React.FC<Props> = ({ children, variant = "primary", style }) => {
  const v = variantMap[variant];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", padding: "3px 10px",
        borderRadius: 99, fontSize: 11, fontWeight: 700,
        background: v.bg, color: v.color, whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export default ThemedBadge;
