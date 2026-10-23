// The phone bars' footprint on a notched phone: a 44px top bar, a 48px bottom
// bar with Submit rising out of it, the queue collapsed into a pill in the top
// bar, and a match found as a dialog in the middle of the screen.
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

// The signed-in test user's player in Test League (scripts/seed-data.sql).
const VIEWER = '66666666-6666-6666-6666-666666666601';
const [alice, bob] = QUEUE.queuedPlayers;
const MATCH_FOUND = {
  queuedPlayers: [],
  pendingMatch: {
    id: 'eeeeeeee-4000-0000-0000-000000000001',
    status: 'Pending',
    expiresAt: new Date(Date.now() + 25_000).toISOString(),
    teams: [
      { index: 0, players: [{ leaguePlayerId: VIEWER, index: 0 }] },
      { index: 1, players: [{ ...alice, index: 0 }] },
    ],
    acceptances: [VIEWER, alice.leaguePlayerId, bob.leaguePlayerId].map(
      (leaguePlayerId) => ({ leaguePlayerId, status: 'Pending' })
    ),
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

    test('a dialog in the middle of the screen asks you to accept', async ({
      page,
    }) => {
      await gotoAuthed(page, `${LEAGUE_HOME}/leaderboard`);
      const dialog = page.getByRole('dialog', { name: 'Match found!' });
      await expect(dialog).toBeVisible();
      const d = await box(dialog);
      expect(Math.abs(d.x + d.width / 2 - 390 / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(d.y + d.height / 2 - HEIGHT / 2)).toBeLessThanOrEqual(1);
      await expect(
        dialog.getByRole('button', { name: 'Accept' })
      ).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'Decline' })
      ).toBeVisible();
      // It replaces the pill rather than adding to it.
      await expect(page.getByRole('button', { name: /in queue/ })).toHaveCount(
        0
      );
    });
  });
});
