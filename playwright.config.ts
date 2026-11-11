import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

// Playwright supplies a legacy `webkit_mac14_arm64_special` binary for this
// host. Its protocol lacks Page.overrideSetting/PushAPIEnabled, so it cannot
// create a page with the current Playwright driver. CI installs normal WebKit
// on Linux and continues to run that project there.
const localSpecialWebKit = (() => {
  if (process.platform !== "darwin" || process.env.CI) return false;
  try {
    return readdirSync(join(homedir(), "Library/Caches/ms-playwright")).some(
      (name) => name.startsWith("webkit_mac14_arm64_special-"),
    );
  } catch {
    return false;
  }
})();
if (localSpecialWebKit)
  console.warn(
    "WebKit browser checks are deferred to CI: the local special WebKit binary is protocol-incompatible with this Playwright version.",
  );

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: process.env.CI ? {} : { channel: "chrome" },
      },
    },
    { name: "firefox", use: { browserName: "firefox" } },
    ...(!localSpecialWebKit
      ? [{ name: "webkit", use: { browserName: "webkit" as const } }]
      : []),
  ],
  webServer: {
    command: "npm start",
    url: `http://127.0.0.1:4173${process.env.TEST_BASE_PATH ?? ""}/`,
    reuseExistingServer: !process.env.CI,
  },
  outputDir: "test-results",
});
