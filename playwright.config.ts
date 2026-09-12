import { defineConfig, devices } from "@playwright/test";

const externalURL = process.env.TEST_BASE_URL;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 35_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: externalURL || "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: externalURL
    ? undefined
    : {
        command: "npm run build && npm run preview -- --port 4173",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
