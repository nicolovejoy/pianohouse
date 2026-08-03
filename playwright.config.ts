import { defineConfig, devices } from "@playwright/test";

const PORT = 3199;

// Disposable local DB — migrate + seed run before the dev server starts, and
// seed-dev.mjs refuses anything that isn't a file: URL, so preview/prod are
// unreachable from here by construction.
const E2E_DB = "file:.playwright/e2e.db";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    // Mints the session row once, serially, before anything else runs. Doing it
    // per-test raced the server for the SQLite write lock (SQLITE_BUSY).
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // A production build, not `next dev`: Next refuses to run two dev servers in
    // one directory, so dev-mode e2e would fail whenever someone has the app
    // running. This also tests what actually ships.
    command:
      "mkdir -p .playwright && node scripts/migrate.mjs && node scripts/seed-dev.mjs && next build && next start --port " +
      PORT,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      TURSO_DATABASE_URL: E2E_DB,
      TURSO_AUTH_TOKEN: "",
      NO_OPEN: "1",
    },
  },
});
