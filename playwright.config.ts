import { defineConfig, devices } from "@playwright/test";

// Les tests E2E tournent sur un build de production, avec la base dédiée registre_e2e (.env.e2e),
// réinitialisée avec les données fictives avant chaque exécution (voir tests/e2e/global-setup.ts).
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "ordinateur", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: `npx dotenv -e .env.e2e -- sh -c "npx next build && npx next start -p ${PORT}"`,
    url: `http://localhost:${PORT}/connexion`,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
