import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "SOURCEMAP_ERROR") return;
        if (warning.message?.includes("sourcemap")) return;
        if (warning.message?.includes("Can't resolve original location"))
          return;
        warn(warning);
      },
    },
  },
  server: {
    port: 5173,
  },
});
