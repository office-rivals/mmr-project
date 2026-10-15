import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base, { STORAGE_STATE } from '../playwright.config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...base,
  outputDir: path.join(here, '../test-results/regressions'),
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'regressions',
      dependencies: ['setup'],
      testMatch: /\.functional\.spec\.ts$/,
      use: { storageState: STORAGE_STATE },
    },
  ],
});
