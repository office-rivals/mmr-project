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

const PORT = process.env.E2E_PORT ?? '5173';
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

// Devs typically run the dev servers themselves and want the e2e command to
// reuse them; CI must always start fresh.
const reuseExistingServer = !process.env.CI;

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
  // Boots Postgres via docker-compose before any webServer process tries to
  // connect to it. Idempotent — re-running with services up is a fast no-op.
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
      url: 'http://localhost:8080/swagger/index.html',
      timeout: 60_000,
      reuseExistingServer,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // .NET API. Runs migrations on startup, so Postgres must be up.
      name: 'api',
      command: 'dotnet run',
      cwd: apiDir,
      url: 'http://localhost:8081/swagger/v3/swagger.json',
      timeout: 180_000,
      reuseExistingServer,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // SvelteKit dev server. Calls into the .NET API via SSR for some routes,
      // so we want it up last — Playwright doesn't enforce ordering, but the
      // URL probe below blocks until the dev server actually serves a page.
      name: 'frontend',
      command: 'npm run dev',
      url: `${BASE_URL}/login`,
      timeout: 60_000,
      reuseExistingServer,
      stdout: 'pipe',
      stderr: 'pipe',
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
