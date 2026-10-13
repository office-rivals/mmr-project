import playwright from '../../frontend/node_modules/@playwright/test/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import shared from '../../frontend/playwright.config';
const { defineConfig } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const servers = (
  Array.isArray(shared.webServer) ? shared.webServer : [shared.webServer]
).filter(Boolean);

export default defineConfig({
  ...shared,
  testDir: here,
  outputDir: path.join(here, '../test-results/regressions'),
  globalSetup: path.join(repo, 'frontend/e2e/global-services.setup.ts'),
  webServer: servers.map((server) =>
    server!.name === 'frontend'
      ? { ...server!, cwd: path.join(repo, 'frontend-beta') }
      : server!
  ),
  projects: [
    {
      name: 'setup',
      testDir: path.join(repo, 'frontend/e2e'),
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'regressions',
      dependencies: ['setup'],
      testMatch: /.*\.functional\.spec\.ts/,
      use: { storageState: path.join(repo, 'frontend/e2e/.auth/user.json') },
    },
  ],
});
