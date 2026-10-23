// The phone bars' footprint on a notched phone: a 44px top bar, a 48px bottom
// bar with Submit rising out of it, and the live strip docked on top of the
// bottom bar with its content kept either side of Submit.
import { test, expect, type Page } from '@playwright/test';
import { gotoAuthed } from './helpers';

const LEAGUE_HOME = '/test-org/test-league';
const INSETS = { top: 59, bottom: 34, left: 0, right: 0 };
const HEIGHT = 844;
// Each bar's hairline border sits outside its stated height.
const BORDER = 1;

const QUEUE = {
  queuedPlayers: [
    {
      leaguePlayerId: 'bed02f01-6ea5-514a-9815-dbf9fdaacfa7',
      displayName: 'Alice Anderson',
      username: 'alia',
      joinedAt: new Date().toISOString(),
    },
    {
      leaguePlayerId: 'f6a97f23-2a35-58c3-b1e0-6085c728ae2d',
      displayName: 'Bob Brown',
      username: 'bobr',
      joinedAt: new Date().toISOString(),
    },
  ],
};

const stubQueue = (page: Page) =>
  page.route('**/api/v3/organizations/*/leagues/*/queue', (route) =>
    route.fulfill({ json: QUEUE })
  );

const bottomBar = (page: Page) =>
  page.getByRole('navigation', { name: 'Primary' });
const submitTile = (page: Page) =>
  bottomBar(page).getByRole('link', { name: 'Submit' }).locator('span').first();
const strip = (page: Page) => page.getByRole('region', { name: 'Queue' });

async function box(locator: ReturnType<Page['locator']>) {
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b!;
}

/** Scrolls to the end and returns the bottom edge of the page's last block. */
async function contentBottom(page: Page) {
  return page.evaluate(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'instant',
    });
    const column = document.querySelector('#content > div')!;
    return column.lastElementChild!.getBoundingClientRect().bottom;
  });
}

test.describe('Phone chrome on a notched phone', () => {
  test.use({ viewport: { width: 390, height: HEIGHT } });

  test.beforeEach(async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send(
      'Emulation.setSafeAreaInsetsOverride' as never,
      {
        insets: INSETS,
      } as never
    );
  });

  test('the bars take 44px at the top and 48px at the bottom', async ({
    page,
  }) => {
    await gotoAuthed(page, LEAGUE_HOME);
    const top = await box(page.locator('[data-phone-chrome]').first());
    const bottom = await box(bottomBar(page));
    expect(top.y + top.height).toBe(INSETS.top + 44 + BORDER);
    expect(bottom.height).toBe(BORDER + 48 + INSETS.bottom);
    expect(bottom.y + bottom.height).toBe(HEIGHT);
  });

  test('Submit rises 14px above the bottom bar', async ({ page }) => {
    await gotoAuthed(page, LEAGUE_HOME);
    const bar = await box(bottomBar(page));
    const tile = await box(submitTile(page));
    expect(bar.y + BORDER - tile.y).toBe(14);
  });

  test('content scrolls clear of Submit', async ({ page }) => {
    await gotoAuthed(page, `${LEAGUE_HOME}/leaderboard`);
    const tile = await box(submitTile(page));
    expect(await contentBottom(page)).toBeLessThanOrEqual(tile.y);
  });

  test.describe('with players in the queue', () => {
    test.beforeEach(async ({ page }) => {
      await stubQueue(page);
    });

    test('the strip docks on the bar and keeps clear of Submit', async ({
      page,
    }) => {
      await gotoAuthed(page, LEAGUE_HOME);
      await expect(strip(page)).toBeVisible();
      const s = await box(strip(page));
      const bar = await box(bottomBar(page));
      const tile = await box(submitTile(page));
      expect(s.height).toBe(BORDER + 44);
      expect(s.y + s.height).toBe(bar.y);
      // The tile rises into the strip's lower half.
      expect(tile.y).toBeGreaterThan(s.y + s.height / 2);

      const text = await box(strip(page).getByRole('link'));
      const join = await box(strip(page).getByRole('button', { name: 'Join' }));
      expect(text.x + text.width).toBeLessThan(tile.x);
      expect(join.x).toBeGreaterThan(tile.x + tile.width);
    });

    test('Join and Submit take taps across the whole strip', async ({
      page,
    }) => {
      await gotoAuthed(page, LEAGUE_HOME);
      await expect(strip(page)).toBeVisible();
      const s = await box(strip(page));
      const join = await box(strip(page).getByRole('button', { name: 'Join' }));
      const tile = await box(submitTile(page));
      const hit = (x: number, y: number) =>
        page.evaluate(
          ([px, py]) =>
            document
              .elementFromPoint(px, py)
              ?.closest('a, button')
              ?.textContent?.trim() ?? null,
          [x, y]
        );
      // The 32px button's hit area spans the 44px strip.
      const x = join.x + join.width / 2;
      expect(await hit(x, s.y + BORDER + 1)).toBe('Join');
      expect(await hit(x, s.y + s.height - 1)).toBe('Join');
      // Where the tile overlaps the strip, the tap goes to Submit.
      expect(await hit(tile.x + tile.width / 2, tile.y + 2)).toBe('Submit');
    });

    test('content scrolls clear of the strip', async ({ page }) => {
      await gotoAuthed(page, `${LEAGUE_HOME}/leaderboard`);
      await expect(strip(page)).toBeVisible();
      const s = await box(strip(page));
      expect(await contentBottom(page)).toBeLessThanOrEqual(s.y);
    });
  });
});
