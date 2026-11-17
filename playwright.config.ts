import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: "es-ES",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: "/opt/google/chrome/chrome",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/brand/serbell-logo.png",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
