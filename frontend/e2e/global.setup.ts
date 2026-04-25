import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as setup, expect } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const authFile = path.join(here, '.auth', 'user.json');

const userEmail = process.env.E2E_USER_EMAIL;
const userPassword = process.env.E2E_USER_PASSWORD;
const identityUserId = process.env.E2E_IDENTITY_USER_ID;

if (!userEmail || !userPassword || !identityUserId) {
  throw new Error(
    'E2E_USER_EMAIL, E2E_USER_PASSWORD and E2E_IDENTITY_USER_ID must be set ' +
      '(see frontend/.env.e2e.example).'
  );
}

setup('apply seed and sign in', async ({ page }) => {
  // 1. Reset DB to vendored seed, with the test user's Clerk identity.
  // execFileSync (with shell: false by default) bypasses shell parsing so
  // unusual characters in projectRoot can't be interpreted as commands.
  execFileSync(path.join(projectRoot, 'scripts', 'seed-local.sh'), [], {
    stdio: 'inherit',
    env: {
      ...process.env,
      IDENTITY_USER_ID: identityUserId,
      USER_EMAIL: userEmail,
    },
  });

  // 2. Sign in via Clerk's hosted UI. We reuse the resulting session for all
  // subsequent specs by saving storageState.
  await page.goto('/login');
  await page.locator('input[name=identifier]').fill(userEmail);
  await page.locator('input[name=identifier]').press('Enter');
  await page.locator('input[name=password]').fill(userPassword);
  await page.locator('input[name=password]').press('Enter');

  // After sign-in we land on either the home page (org list) or, when the
  // seed wires us into a single org/league, on the leaderboard route.
  await expect(page).toHaveURL(/\/(test-org\/test-league|$)/, {
    timeout: 15_000,
  });

  await page.context().storageState({ path: authFile });
});
