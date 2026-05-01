import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

loadEnv({ path: '.env.e2e', quiet: true });
loadEnv({ path: '.env', quiet: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const apiDir = path.join(repoRoot, 'api/MMRProject.Api');
const mmrApiDir = path.join(repoRoot, 'mmr-api');

// E2E runs on a parallel set of ports so it never collides with a local dev
// stack (Postgres 5432, mmr-api 8080, .NET API 8081, Vite 5173). All four are
// overridable via env vars for CI flexibility.
const E2E_DB_HOST = process.env.E2E_DB_HOST ?? 'localhost';
const E2E_DB_PORT = process.env.E2E_DB_PORT ?? '5433';
const E2E_DB_NAME = process.env.E2E_DB_NAME ?? 'mmr_project';
const E2E_DB_USER = process.env.E2E_DB_USER ?? 'postgres';
const E2E_DB_PASS = process.env.E2E_DB_PASS ?? 'this_is_a_hard_password1337';
const E2E_MMR_API_PORT = process.env.E2E_MMR_API_PORT ?? '8090';
const E2E_API_PORT = process.env.E2E_API_PORT ?? '8091';
const E2E_FRONTEND_PORT = process.env.E2E_PORT ?? '5180';

const MMR_API_URL = `http://localhost:${E2E_MMR_API_PORT}`;
const API_URL = `http://localhost:${E2E_API_PORT}`;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${E2E_FRONTEND_PORT}`;

const API_CONNECTION_STRING =
  `Host=${E2E_DB_HOST};Port=${E2E_DB_PORT};` +
  `Database=${E2E_DB_NAME};Username=${E2E_DB_USER};Password=${E2E_DB_PASS}`;

// E2E ports are dedicated, so reusing an "existing server" makes no sense —
// the only thing that could already be on those ports is a previous, possibly
// stale, e2e run. Always start fresh.
const reuseExistingServer = false;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // tests share the seeded DB; serialize for determinism
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Boots the e2e Postgres via docker-compose before any webServer process
  // tries to connect to it. Idempotent — re-running with services up is a
  // fast no-op.
  globalSetup: './e2e/global-services.setup.ts',
  // Each entry is started in parallel; Playwright waits on every URL before
  // running tests. The .NET API needs Postgres up first, which globalSetup
  // already guarantees.
  webServer: [
    {
      // Go MMR calculation service. Independent of Postgres.
      name: 'mmr-api',
      command: 'go run main.go',
      cwd: mmrApiDir,
      url: `${MMR_API_URL}/swagger/index.html`,
      timeout: 60_000,
      reuseExistingServer,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        MMR_API_PORT: E2E_MMR_API_PORT,
      },
    },
    {
      // .NET API. Runs migrations on startup, so Postgres must be up.
      // --no-launch-profile so launchSettings.json's hardcoded port 8081
      // doesn't beat the ASPNETCORE_URLS env override below.
      name: 'api',
      command: 'dotnet run --no-launch-profile',
      cwd: apiDir,
      url: `${API_URL}/swagger/v3/swagger.json`,
      timeout: 180_000,
      reuseExistingServer,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        ASPNETCORE_URLS: API_URL,
        ConnectionStrings__ApiDbContext: API_CONNECTION_STRING,
        MMRCalculationAPI__BaseUrl: MMR_API_URL,
      },
    },
    {
      // SvelteKit dev server. Calls into the .NET API via SSR for some routes,
      // so we want it up last — Playwright doesn't enforce ordering, but the
      // URL probe below blocks until the dev server actually serves a page.
      name: 'frontend',
      // --strictPort so a port collision surfaces a clear error instead of
      // Vite silently sliding to the next free port (which Playwright would
      // then never find).
      command: `npm run dev -- --port ${E2E_FRONTEND_PORT} --strictPort`,
      url: `${BASE_URL}/login`,
      timeout: 60_000,
      reuseExistingServer,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        API_BASE_PATH: API_URL,
      },
    },
  ],
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: /global\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
    },
  ],
});
