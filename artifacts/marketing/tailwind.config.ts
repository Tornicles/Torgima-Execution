import type { Config } from "tailwindcss";
import { withTorgimaPreset } from "@workspace/design-system/tailwind";

const config: Config = withTorgimaPreset({
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/design-system/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "dark-hover": "#241535",
        primary: {
          DEFAULT: "#6B21A8",
          bright: "#A855F7",
          soft: "#7C3AED",
        },
      },
    },
  },
  plugins: [],
});

export default config;
