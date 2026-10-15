import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base, { STORAGE_STATE } from '../playwright.config';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.E2E_PORT ?? '5180';
const servers = (
  Array.isArray(base.webServer) ? base.webServer : [base.webServer]
).filter((server) => server != null);

export default defineConfig({
  ...base,
  use: { ...base.use, timezoneId: 'Europe/Copenhagen', locale: 'en-US' },
  outputDir: path.join(appDir, 'test-results/production'),
  webServer: servers.map((server) =>
    server.name === 'frontend'
      ? {
          ...server,
          command: 'npm start',
          env: {
            ...server.env,
            PORT: port,
            HOST: '127.0.0.1',
            NODE_ENV: 'production',
            TZ: 'UTC',
            APP_ORIGIN: `http://localhost:${port}`,
            CLERK_AUTHORIZED_PARTIES: `http://localhost:${port}`,
          },
        }
      : server
  ),
  projects: [
    // `setup`, then the whole e2e suite in Chromium.
    ...(base.projects ?? []),
    // Each browser needs a fresh seed: repeated match submissions are rejected.
    ...(['webkit', 'firefox'] as const).flatMap((browser) => {
      const device =
        devices[browser === 'webkit' ? 'Desktop Safari' : 'Desktop Firefox'];
      return [
        {
          name: `${browser}-setup`,
          dependencies: [browser === 'webkit' ? 'chromium' : 'webkit-smoke'],
          testMatch: /global\.setup\.ts/,
          use: { ...device },
        },
        {
          name: `${browser}-smoke`,
          dependencies: [`${browser}-setup`],
          testMatch: /(?:header|submit|admin-rbac)\.e2e\.spec\.ts$/,
          use: { ...device, storageState: STORAGE_STATE },
        },
      ];
    }),
    {
      name: 'production-contract',
      dependencies: ['firefox-smoke'],
      testMatch: /\.production\.spec\.ts$/,
      use: { storageState: STORAGE_STATE },
    },
  ],
});
