/**
 * ThemedInput — Input that consumes CSS theme variables.
 */
import React from "react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

const ThemedInput: React.FC<Props> = ({ label, error, fullWidth = true, style, ...rest }) => (
  <div style={{ width: fullWidth ? "100%" : undefined }}>
    {label && (
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-color, #111827)", marginBottom: 4 }}>
        {label}
      </label>
    )}
    <input
      style={{
        width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
        border: error ? "1.5px solid var(--danger-color, var(--customer-primary))" : "1.5px solid #d1d5db",
        outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
        color: "var(--text-color, #111827)", background: "var(--background-color, #ffffff)",
        boxSizing: "border-box", ...style,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = "var(--primary-color, #2563eb)";
        e.target.style.boxShadow = "0 0 0 3px var(--focus-ring-color, rgba(37,99,235,0.35))";
      }}
      onBlur={(e) => {
        e.target.style.borderColor = error ? "var(--danger-color, var(--customer-primary))" : "#d1d5db";
        e.target.style.boxShadow = "none";
      }}
      {...rest}
    />
    {error && <span style={{ fontSize: 12, color: "var(--danger-color, var(--customer-primary))", marginTop: 2, display: "block" }}>{error}</span>}
  </div>
);

export default ThemedInput;
