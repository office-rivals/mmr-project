import playwright from '../../frontend/node_modules/@playwright/test/index.js';
const { defineConfig } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import shared from '../../frontend/playwright.config';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const referenceURL = `http://localhost:${process.env.E2E_PORT ?? '5180'}`;
const betaPort = process.env.PARITY_BETA_PORT ?? '5181';
const servers = (
  Array.isArray(shared.webServer) ? shared.webServer : [shared.webServer]
).filter(Boolean);

export default defineConfig({
  ...shared,
  testDir: here,
  outputDir: path.join(here, '../test-results/visual'),
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: path.join(here, '../playwright-report/visual'),
        open: 'never',
      },
    ],
  ],
  globalSetup: path.join(repo, 'frontend/e2e/global-services.setup.ts'),
  webServer: [
    ...servers.map((server) =>
      server!.name === 'frontend'
        ? {
            ...server!,
            env: { ...server!.env, TZ: 'UTC' },
            cwd: path.join(repo, 'frontend'),
            url: `${referenceURL}/login`,
          }
        : server!
    ),
    {
      name: 'frontend-beta',
      command: `npm run dev -- --port ${betaPort} --strictPort`,
      cwd: path.join(repo, 'frontend-beta'),
      url: `http://localhost:${betaPort}/login`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        TZ: 'UTC',
        API_BASE_PATH: `http://localhost:${process.env.E2E_API_PORT ?? '8091'}`,
      },
    },
  ],
  projects: [
    {
      name: 'setup',
      testDir: path.join(repo, 'frontend/e2e'),
      testMatch: /global\.setup\.ts/,
      use: { baseURL: referenceURL },
    },
    {
      name: 'fixtures',
      dependencies: ['setup'],
      testDir: here,
      testMatch: /fixtures\.setup\.ts/,
    },
    {
      name: 'visual',
      dependencies: ['fixtures'],
      testMatch: /(?:visual|visual-policy|.*\.keyboard)\.spec\.ts/,
      use: {
        storageState: path.join(here, '../test-results/visual/auth.json'),
        locale: 'en-US',
        timezoneId: 'UTC',
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
  ],
});
