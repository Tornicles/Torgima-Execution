import type { Config } from "tailwindcss";
import { DESIGN_TOKENS } from "./tokens";

/** Tailwind v3 theme extension for @workspace/marketing */
export const torgimaTailwindTheme = {
  colors: {
    dark: {
      DEFAULT: DESIGN_TOKENS.colors.dark,
      card: DESIGN_TOKENS.colors.darkCard,
      border: DESIGN_TOKENS.colors.darkBorder,
      hover: DESIGN_TOKENS.colors.darkHover,
    },
    primary: {
      DEFAULT: DESIGN_TOKENS.colors.primary,
      bright: DESIGN_TOKENS.colors.primaryBright,
      soft: DESIGN_TOKENS.colors.primarySoft,
    },
    light: DESIGN_TOKENS.colors.textPrimary,
    success: DESIGN_TOKENS.colors.success,
    warning: DESIGN_TOKENS.colors.warning,
    danger: DESIGN_TOKENS.colors.danger,
    "text-primary": DESIGN_TOKENS.colors.textPrimary,
    "text-secondary": DESIGN_TOKENS.colors.textSecondary,
    "text-muted": DESIGN_TOKENS.colors.textMuted,
  },
  fontFamily: {
    heading: ["var(--font-syne)", "Syne", "system-ui", "sans-serif"],
    body: ["var(--font-dm)", "Plus Jakarta Sans", "DM Sans", "system-ui", "sans-serif"],
    mono: ["var(--font-jet)", "JetBrains Mono", "ui-monospace", "monospace"],
    syne: ["var(--font-syne)", "Syne", "system-ui", "sans-serif"],
    dm: ["var(--font-dm)", "DM Sans", "system-ui", "sans-serif"],
    jet: ["var(--font-jet)", "JetBrains Mono", "ui-monospace", "monospace"],
  },
  backgroundImage: {
    "hero-gradient": DESIGN_TOKENS.gradients.hero,
    "card-gradient": DESIGN_TOKENS.gradients.card,
    "purple-glow": DESIGN_TOKENS.gradients.purpleGlow,
    "primary-gradient": DESIGN_TOKENS.gradients.primary,
  },
  boxShadow: {
    glow: DESIGN_TOKENS.shadows.glow,
    "glow-strong": DESIGN_TOKENS.shadows.glowStrong,
    card: DESIGN_TOKENS.shadows.card,
    "card-hover": DESIGN_TOKENS.shadows.cardHover,
  },
  maxWidth: {
    content: "1200px",
  },
};

export function withTorgimaPreset(config: Config): Config {
  return {
    ...config,
    theme: {
      ...config.theme,
      extend: {
        ...config.theme?.extend,
        ...torgimaTailwindTheme,
      },
    },
  };
}
