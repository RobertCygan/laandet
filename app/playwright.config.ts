import { defineConfig, devices } from "@playwright/test";
import { applyTestEnv } from "./tests/integration/env";

// The server under test uses the *_test database and a temporary media folder (never dev or prod data).
applyTestEnv();
// E2E_PORT lets two test runs share one machine.
const PORT = Number(process.env.E2E_PORT ?? 3100);
process.env.APP_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Every journey runs at a phone viewport; the main journey and smoke checks also on desktop (TEST_STRATEGY §5).
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /(journey|smoke)\.spec\.ts/ },
  ],
  // Run `npm run build` first; the production server is what we test (dev mode adds HMR noise).
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...(process.env as Record<string, string>) },
  },
});
