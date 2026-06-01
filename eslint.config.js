import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/tests/**",
      "**/*seed*.ts",
      "lib/api-zod/**",
      "lib/db/src/verify-db.ts",
    ],
  },
  {
    files: [
      "artifacts/api-server/src/**/*.ts",
      "lib/**/*.ts",
    ],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
