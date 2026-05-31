export const DESIGN_TOKENS = {
  colors: {
    dark: "#0F0A1A",
    darkCard: "#1A1025",
    darkBorder: "#2D1F40",
    darkHover: "#241535",

    primary: "#6B21A8",
    primaryBright: "#A855F7",
    primarySoft: "#7C3AED",
    primaryGlow: "rgba(168, 85, 247, 0.15)",

    textPrimary: "#FAFAF9",
    textSecondary: "#A1A1AA",
    textMuted: "#6B7280",

    success: "#10B981",
    successSoft: "rgba(16, 185, 129, 0.1)",

    warning: "#F59E0B",
    warningSoft: "rgba(245, 158, 11, 0.1)",

    danger: "#EF4444",
    dangerSoft: "rgba(239, 68, 68, 0.1)",

    conditions: {
      nothingness: "#6B7280",
      danger: "#EF4444",
      urgency: "#F59E0B",
      stability: "#10B981",
      power: "#6366F1",
      affluence: "#A855F7",
      powerChange: "#F59E0B",
    },
  },

  typography: {
    fontHeading: "'Syne', 'Clash Display', sans-serif",
    fontBody: "'Plus Jakarta Sans', 'DM Sans', sans-serif",
    fontMono: "'JetBrains Mono', monospace",
    sizes: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
      "6xl": "3.75rem",
      "7xl": "4.5rem",
    },
    weights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900,
    },
  },

  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
    "3xl": "64px",
    "4xl": "96px",
    "5xl": "128px",
  },

  radii: {
    sm: "6px",
    md: "10px",
    lg: "16px",
    xl: "24px",
    full: "9999px",
  },

  shadows: {
    glow: "0 0 40px rgba(168, 85, 247, 0.15)",
    glowStrong: "0 0 60px rgba(168, 85, 247, 0.25)",
    card: "0 4px 24px rgba(0, 0, 0, 0.4)",
    cardHover: "0 8px 40px rgba(0, 0, 0, 0.5)",
  },

  animation: {
    fast: "150ms ease",
    normal: "250ms ease",
    slow: "400ms ease",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },

  gradients: {
    hero: "radial-gradient(ellipse at top center, #3B0764 0%, #0F0A1A 60%)",
    card: "linear-gradient(135deg, #1A1025 0%, #0F0A1A 100%)",
    primary: "linear-gradient(135deg, #6B21A8 0%, #A855F7 100%)",
    purpleGlow: "radial-gradient(ellipse at center, rgba(168,85,247,0.15) 0%, transparent 70%)",
  },
} as const;

export type ConditionKey =
  | "nothingness"
  | "danger"
  | "urgency"
  | "stability"
  | "power"
  | "affluence"
  | "powerChange"
  | "power_change";
