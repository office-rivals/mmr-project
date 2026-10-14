import playwright, {
  type Page,
} from '../../frontend/node_modules/@playwright/test/index.js';

const { expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

export async function gotoAuthed(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  if (new URL(page.url()).pathname !== path) {
    await expect(page.getByLabel('Settings menu')).toBeVisible();
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  await expect(page).toHaveURL(path);
}
