// Keyboard and repeat-press behaviour of the shared controls: the show-MMR
// switches and the submit flow's winner and score pickers.
import { test, expect, type Page } from '@playwright/test';

const LEAGUE_URL = '/test-org/test-league';

async function pickPlayer(page: Page, displayName: string) {
  const input = page.locator('input[placeholder="Filter..."]').first();
  await input.fill(displayName);
  await page
    .getByRole('option', { name: new RegExp(displayName) })
    .first()
    .click();
}

test.describe('Show-MMR switch', () => {
  test('toggles from the keyboard, persists, and is shared with the matches page', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);
    const home = page.getByRole('switch', { name: 'MMR:' });
    await expect(home).toBeEnabled();
    await expect(home).toHaveAttribute('aria-checked', 'false');

    await home.focus();
    await page.keyboard.press('Space');
    await expect(home).toHaveAttribute('aria-checked', 'true');

    await page.reload();
    await expect(page.getByRole('switch', { name: 'MMR:' })).toHaveAttribute(
      'aria-checked',
      'true'
    );

    await page.goto(`${LEAGUE_URL}/matches`);
    const matches = page.getByRole('switch', { name: 'MMR changes' });
    await expect(matches).toBeEnabled();
    await expect(matches).toHaveAttribute('aria-checked', 'true');
    // The whole label is the hit target, not just the track.
    await page.getByText('MMR changes', { exact: true }).click();
    await expect(matches).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('Submit pickers', () => {
  test('a picked winner or score stays picked when pressed again', async ({
    page,
  }) => {
    await page.goto(`${LEAGUE_URL}/submit`);
    await pickPlayer(page, 'Alice Anderson');
    await pickPlayer(page, 'Bob Brown');
    await pickPlayer(page, 'Carol Carter');
    await pickPlayer(page, 'Dave Davies');

    const we = page.getByRole('button', { name: /We won/ });
    const they = page.getByRole('button', { name: /They won/ });
    await we.click();
    await we.click();
    await expect(we).toHaveAttribute('aria-pressed', 'true');
    await expect(they).toHaveAttribute('aria-pressed', 'false');

    const scoreStep = page.locator('#score-step');
    const five = scoreStep.getByRole('button', { name: '5', exact: true });
    await five.click();
    await five.click();
    await expect(five).toHaveAttribute('aria-pressed', 'true');

    // Arrow keys move between the winner buttons; Space swaps the winner.
    await we.focus();
    await page.keyboard.press('ArrowRight');
    await expect(they).toBeFocused();
    await page.keyboard.press('Space');
    await expect(they).toHaveAttribute('aria-pressed', 'true');
    await expect(we).toHaveAttribute('aria-pressed', 'false');
    await expect(
      page.getByRole('heading', { name: /What was your score\?/ })
    ).toBeVisible();
    // Intentionally does not submit — non-mutating.
  });
});
