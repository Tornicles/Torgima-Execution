import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        syne: ["var(--font-syne)", "system-ui", "sans-serif"],
        dm: ["var(--font-dm)", "system-ui", "sans-serif"],
        jet: ["var(--font-jet)", "ui-monospace", "monospace"],
      },
      spacing: {
        section: "140px",
        "section-sm": "80px",
      },
      maxWidth: {
        content: "720px",
        panel: "960px",
      },
    },
  },
  plugins: [],
};
export default config;
