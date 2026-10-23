// The phone bars' footprint on a notched phone: a 44px top bar, a 48px bottom
// bar with Submit rising out of it, the queue collapsed into a pill in the top
// bar, and a match found as a tall strip on the bottom bar.
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

const MATCH_FOUND = {
  queuedPlayers: [],
  pendingMatch: {
    id: 'eeeeeeee-4000-0000-0000-000000000001',
    status: 'Pending',
    expiresAt: new Date(Date.now() + 40_000).toISOString(),
    teams: [],
    acceptances: [],
  },
};

const stubQueue = (page: Page, json: object) =>
  page.route('**/api/v3/organizations/*/leagues/*/queue', (route) =>
    route.fulfill({ json })
  );

const bottomBar = (page: Page) =>
  page.getByRole('navigation', { name: 'Primary' });
const submitTile = (page: Page) =>
  bottomBar(page).getByRole('link', { name: 'Submit' }).locator('span').first();
const topBar = (page: Page) => page.locator('[data-phone-chrome]').first();
const queuePill = (page: Page) =>
  page.getByRole('button', { name: '2 in queue' });

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
    const top = await box(topBar(page));
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
      await stubQueue(page, QUEUE);
    });

    test('the queue is a pill in the top bar, leaving the bottom clear', async ({
      page,
    }) => {
      await gotoAuthed(page, `${LEAGUE_HOME}/leaderboard`);
      await expect(queuePill(page)).toBeVisible();
      const bar = await box(topBar(page));
      const pill = await box(queuePill(page));
      expect(pill.height).toBe(44);
      expect(pill.y).toBe(INSETS.top);
      expect(pill.y + pill.height).toBeLessThanOrEqual(bar.y + bar.height);
      await expect(page.locator('[data-live-strip]')).toHaveCount(0);

      const tile = await box(submitTile(page));
      expect(await contentBottom(page)).toBeLessThanOrEqual(tile.y);
    });

    test('the pill opens the queue under the top bar until Escape', async ({
      page,
    }) => {
      await gotoAuthed(page, LEAGUE_HOME);
      await queuePill(page).click();
      const panel = page.getByRole('dialog', { name: 'Queue' });
      await expect(panel).toBeVisible();
      const bar = await box(topBar(page));
      const p = await box(panel);
      expect(p.y).toBe(bar.y + bar.height);
      expect(p.x).toBe(0);
      expect(p.width).toBe(390);
      await expect(panel).toContainText('Alice Anderson and Bob Brown');
      const join = await box(panel.getByRole('button', { name: 'Join' }));
      expect(join.height).toBe(44);

      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(queuePill(page)).toBeFocused();
    });
  });

  test.describe('with a match found', () => {
    test.beforeEach(async ({ page }) => {
      await stubQueue(page, MATCH_FOUND);
    });

    test('a tall strip docks on the bar with a countdown', async ({ page }) => {
      await gotoAuthed(page, `${LEAGUE_HOME}/leaderboard`);
      const strip = page.getByRole('region', { name: 'Match found' });
      await expect(strip).toBeVisible();
      await expect(strip).toContainText(/Expires in 0:[0-4]\d/);
      // It never collapses into the pill.
      await expect(page.getByRole('button', { name: /in queue/ })).toHaveCount(
        0
      );

      const s = await box(strip);
      const bar = await box(bottomBar(page));
      const tile = await box(submitTile(page));
      expect(s.height).toBe(2 + 64);
      expect(s.y + s.height).toBe(bar.y);
      const respond = await box(strip.getByRole('link', { name: 'Respond' }));
      expect(respond.height).toBe(44);
      expect(respond.x).toBeGreaterThan(tile.x + tile.width);
      expect(await contentBottom(page)).toBeLessThanOrEqual(s.y);
    });
  });
});
