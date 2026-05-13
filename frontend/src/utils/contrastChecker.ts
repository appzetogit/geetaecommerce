/**
 * WCAG Contrast Checker
 * Validates color combinations for accessibility compliance.
 */

import { getContrastRatio } from "./colorUtils";

export type ContrastLevel = "AAA" | "AA" | "FAIL";

export interface ContrastResult {
  ratio: number;
  normalText: ContrastLevel;
  largeText: ContrastLevel;
  uiComponent: ContrastLevel;
  score: "excellent" | "good" | "poor";
  message: string;
}

/**
 * Check contrast between foreground and background colors.
 * Returns WCAG conformance levels for different text sizes.
 */
export const checkContrast = (
  foreground: string,
  background: string
): ContrastResult => {
  const ratio = getContrastRatio(foreground, background);

  // WCAG 2.1 thresholds
  const normalText: ContrastLevel =
    ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : "FAIL";
  const largeText: ContrastLevel =
    ratio >= 4.5 ? "AAA" : ratio >= 3 ? "AA" : "FAIL";
  const uiComponent: ContrastLevel = ratio >= 3 ? "AA" : "FAIL";

  let score: "excellent" | "good" | "poor";
  let message: string;

  if (ratio >= 7) {
    score = "excellent";
    message = "Excellent contrast — meets AAA for all text sizes";
  } else if (ratio >= 4.5) {
    score = "good";
    message = "Good contrast — meets AA for normal text";
  } else if (ratio >= 3) {
    score = "poor";
    message = "Minimum contrast — only suitable for large text or UI elements";
  } else {
    score = "poor";
    message = "Poor contrast — does not meet accessibility standards";
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    normalText,
    largeText,
    uiComponent,
    score,
    message,
  };
};

/**
 * Check if a color combination is safe to save
 * (at minimum meets AA for large text / UI components)
 */
export const isSafeContrast = (
  foreground: string,
  background: string
): boolean => {
  const ratio = getContrastRatio(foreground, background);
  return ratio >= 3;
};

/**
 * Get a badge-style color for contrast score
 */
export const getContrastBadgeColor = (
  score: "excellent" | "good" | "poor"
): string => {
  switch (score) {
    case "excellent":
      return "#10b981";
    case "good":
      return "#f59e0b";
    case "poor":
      return "#ef4444";
  }
};
