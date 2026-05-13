/**
 * ThemedButton — Button that consumes CSS theme variables.
 */
import React from "react";

type Variant = "primary" | "secondary" | "accent" | "outline" | "danger" | "success" | "ghost";
type Size = "sm" | "md" | "lg";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--primary-color, #2563eb)", color: "var(--primary-text-color, #fff)", border: "none" },
  secondary: { background: "var(--secondary-color, #1e40af)", color: "#fff", border: "none" },
  accent: { background: "var(--accent-color, #f59e0b)", color: "#fff", border: "none" },
  outline: { background: "transparent", color: "var(--primary-color, #2563eb)", border: "2px solid var(--primary-color, #2563eb)" },
  danger: { background: "var(--danger-color, var(--customer-primary))", color: "#fff", border: "none" },
  success: { background: "var(--success-color, #10b981)", color: "#fff", border: "none" },
  ghost: { background: "var(--hover-bg, rgba(37,99,235,0.08))", color: "var(--primary-color, #2563eb)", border: "none" },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: "6px 14px", fontSize: 12 },
  md: { padding: "10px 20px", fontSize: 14 },
  lg: { padding: "14px 28px", fontSize: 16 },
};

const ThemedButton: React.FC<Props> = ({
  variant = "primary", size = "md", loading, fullWidth, children, style, disabled, ...rest
}) => (
  <button
    disabled={disabled || loading}
    style={{
      borderRadius: 8, fontWeight: 600, cursor: disabled || loading ? "not-allowed" : "pointer",
      transition: "all 0.2s ease", opacity: disabled || loading ? 0.6 : 1,
      width: fullWidth ? "100%" : undefined,
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      ...variantStyles[variant], ...sizeStyles[size], ...style,
    }}
    {...rest}
  >
    {loading && <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />}
    {children}
  </button>
);

export default ThemedButton;
