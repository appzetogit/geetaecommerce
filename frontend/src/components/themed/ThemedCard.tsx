/**
 * ThemedCard — Card that consumes CSS theme variables.
 */
import React from "react";

interface Props {
  children: React.ReactNode;
  padding?: number;
  bordered?: boolean;
  hoverable?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

const ThemedCard: React.FC<Props> = ({
  children, padding = 16, bordered = true, hoverable, style, className, onClick,
}) => (
  <div
    className={className}
    onClick={onClick}
    style={{
      background: "var(--background-color, #ffffff)",
      borderRadius: 12,
      padding,
      border: bordered ? "1px solid #e2e8f0" : "none",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      transition: "all 0.2s ease",
      cursor: hoverable || onClick ? "pointer" : undefined,
      ...style,
    }}
    onMouseEnter={(e) => {
      if (hoverable) {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px var(--primary-alpha-10, rgba(37,99,235,0.1))";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--primary-alpha-20, rgba(37,99,235,0.2))";
      }
    }}
    onMouseLeave={(e) => {
      if (hoverable) {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
        (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
      }
    }}
  >
    {children}
  </div>
);

export default ThemedCard;
