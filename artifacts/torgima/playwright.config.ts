import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 2 : 0,
  workers: 1,
  reporter: "list",
  expect: {
    timeout: 60_000,
  },
  use: {
    baseURL,
    actionTimeout: 60_000,
    navigationTimeout: 60_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
