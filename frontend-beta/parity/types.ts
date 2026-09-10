import type { Page } from '../../frontend/node_modules/@playwright/test/index.js';

export interface Scene {
  name: string;
  route: string;
  open?: (page: Page) => Promise<void>;
  mask?: string[];
  anonymous?: boolean;
}
