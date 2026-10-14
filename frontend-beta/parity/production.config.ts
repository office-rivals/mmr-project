import shared from '../../frontend/playwright.config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import playwright from '../../frontend/node_modules/@playwright/test/index.js';

const { devices } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const port = process.env.E2E_PORT ?? '5180';
const servers = (
  Array.isArray(shared.webServer) ? shared.webServer : [shared.webServer]
).filter(Boolean);

export default {
  ...shared,
  use: { ...shared.use, timezoneId: 'Europe/Copenhagen', locale: 'en-US' },
  testDir: path.join(repo, 'frontend/e2e'),
  outputDir: path.join(repo, 'frontend-beta/test-results/production'),
  globalSetup: path.join(repo, 'frontend/e2e/global-services.setup.ts'),
  webServer: servers.map((server) =>
    server!.name === 'frontend'
      ? {
          ...server!,
          command: 'npm start',
          cwd: path.join(repo, 'frontend-beta'),
          env: {
            ...server!.env,
            PORT: port,
            HOST: '127.0.0.1',
            NODE_ENV: 'production',
            TZ: 'UTC',
            APP_ORIGIN: `http://localhost:${port}`,
            CLERK_AUTHORIZED_PARTIES: `http://localhost:${port}`,
          },
        }
      : server!
  ),
  projects: [
    ...(shared.projects?.map((project) => ({
      ...project,
      use: {
        ...project.use,
        ...(project.name === 'chromium'
          ? {
              storageState: path.join(repo, 'frontend/e2e/.auth/user.json'),
            }
          : {}),
      },
    })) ?? []),
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
          testMatch: /(?:header|submit|admin-rbac)\.spec\.ts/,
          use: {
            ...device,
            storageState: path.join(repo, 'frontend/e2e/.auth/user.json'),
          },
        },
      ];
    }),
    {
      name: 'production-contract',
      dependencies: ['firefox-smoke'],
      testDir: path.join(repo, 'frontend-beta/parity'),
      testMatch: /.*\.production\.spec\.ts/,
      use: { storageState: path.join(repo, 'frontend/e2e/.auth/user.json') },
    },
  ],
};
