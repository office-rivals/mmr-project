import { execFileSync } from 'node:child_process';
import { test, expect, type Page } from '@playwright/test';
import { gotoAuthed } from './helpers';
import { isServerFn } from './server-fns';

const LEAGUE_URL = '/test-org/test-league';
const STANDINGS_URL = `${LEAGUE_URL}/leaderboard`;

// The league rating history behind the sparklines, fetched on client-side
// navigation.
const isRatingHistoryRoute = (url: URL) =>
  isServerFn(url, 'getLeagueRatingHistoryFn');
// A row's sparkline and the line drawn in it.
const SPARKLINE_SELECTOR = 'svg:has(> polyline)';
const SPARKLINE_LINE_SELECTOR = 'polyline';

test.describe('Leaderboard page', () => {
  test('renders sections in the expected order', async ({ page }) => {
    await page.goto(LEAGUE_URL);

    const headings = page.locator('h1, h2');
    await expect(headings.nth(0)).toHaveText('Leaderboard'); // the page's h1
    await expect(headings.nth(1)).toHaveText('Leaderboard'); // h2 above the table
    await expect(headings.nth(2)).toHaveText('Recent Matches'); // h2 above match cards
  });

  test('table has the expected columns', async ({ page }) => {
    await page.goto(LEAGUE_URL);
    // Hidden cells drop out of the role query, so this is what's on screen.
    await expect(
      page.getByRole('table').first().getByRole('columnheader')
    ).toHaveText(['#', 'Player', 'Wins', 'Losses', 'Win %', 'Trend', 'MMR']);
  });

  test('shows a streak after the wins or losses, with counts and icons lined up', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);
    const rows = page.getByRole('table').first().locator('tbody tr:visible');
    await expect(rows.first()).toBeVisible();
    const streak = /\d+ (wins|losses) in a row/;
    // Player, Win % and MMR never carry a streak.
    await expect(
      rows
        .locator('td:visible:not(:nth-child(3)):not(:nth-child(4))')
        .filter({ hasText: streak })
    ).toHaveCount(0);
    for (const col of [3, 4]) {
      const counts = rows.locator(
        `td:nth-child(${col}) > span > span:first-child`
      );
      await expect(counts.first()).toHaveText(/^\d+$/);
      // The digits themselves end at one x, so the counts are right-aligned.
      const countRight = await counts.evaluateAll((els) =>
        els.map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return Math.round(range.getBoundingClientRect().right);
        })
      );
      expect(new Set(countRight).size).toBe(1);
      const icons = rows.locator(`td:nth-child(${col}) [title$="in a row"]`);
      const iconX = new Set<number>();
      for (const i of await icons.all())
        iconX.add(Math.round((await i.boundingBox())!.x));
      expect(iconX.size).toBeLessThanOrEqual(1);
    }
    // The seed has a win streak; its length shows, matches what a screen
    // reader hears and the player's stats.
    const badge = rows.locator('td:nth-child(3) [title$="in a row"]').first();
    const visible = badge.locator('[aria-hidden]');
    await expect(visible).toBeVisible();
    const shown = (await visible.innerText()).replace(/\D/g, '');
    expect(shown).toMatch(/^\d+$/);
    await expect(badge.locator('.sr-only')).toHaveText(
      new RegExp(`^, ${shown} wins in a row$`)
    );
    await rows
      .filter({ has: page.locator('td:nth-child(3) [title$="in a row"]') })
      .first()
      .click();
    await expect(
      page.getByRole('dialog').getByText(new RegExp(`^\\S+ ${shown}$`))
    ).toBeVisible();
  });

  test('shows the seven players around you and links to the standings', async ({
    page,
  }) => {
    // The standings link is SSR'd; a click before hydration is lost.
    await gotoAuthed(page, LEAGUE_URL);

    // The seed ranks the test user mid-table, so three rows sit on each side.
    const rows = page.getByRole('table').first().locator('tbody tr');
    await expect(rows).toHaveCount(7);
    await expect(rows.nth(3)).toHaveAttribute('aria-current', 'true');
    await expect(rows.nth(3)).toContainText('tuser');

    await page.getByRole('link', { name: /^View all \d+ standings$/ }).click();
    await page.waitForURL(new RegExp(`${STANDINGS_URL}$`));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Leaderboard' })
    ).toBeVisible();
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('shows five rows with short W and L headers', async ({ page }) => {
      await page.goto(LEAGUE_URL);

      const table = page.getByRole('table').first();
      await expect(table.getByRole('columnheader')).toHaveText([
        '#',
        'Player',
        'Wins',
        'Losses',
        'MMR',
      ]);
      const heads = table.getByRole('columnheader');
      expect(await heads.nth(2).innerText()).toBe('W');
      expect(await heads.nth(3).innerText()).toBe('L');
      await expect(table.getByRole('row')).toHaveCount(1 + 5);
      // Centred on the test user on a phone too: two rows on each side.
      await expect(table.locator('tbody tr:visible').nth(2)).toHaveAttribute(
        'aria-current',
        'true'
      );
      // A streak shows its icon after the count, without its length.
      const icons = table.locator('tbody tr:visible [title$="in a row"]');
      await expect(icons.first()).toBeVisible();
      for (const icon of await icons.all())
        expect(await icon.locator('[aria-hidden]').innerText()).toMatch(
          /^\D+$/
        );
      await expect(
        page.getByRole('link', { name: 'View all standings' })
      ).toBeVisible();
    });
  });

  test('shows username (handle) in match cards, not display name', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);
    const firstCard = page
      .locator('.flex.flex-1.flex-col.items-stretch > div.bg-card')
      .first();

    // The seed gives usernames `tuser` (test user), `alia`, `bobr`, etc.
    // and display names like "Test User", "Alice Anderson". Match cards
    // must show the username, not the display name.
    await expect(firstCard).not.toContainText('Alice Anderson');
    await expect(firstCard).not.toContainText('Test User');
  });

  test('defaults to current season (does not show older-season-only data)', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);

    // The season picker label reads "Current Season" by default.
    await expect(page.getByText('Current Season')).toBeVisible();

    // The standings should rank the test user (P1) — they have 11 matches in
    // the current season, above the 10-match ranked threshold. Home only
    // shows the rows around the user, so look on the full standings.
    await page.goto(STANDINGS_URL);
    await expect(page.getByText('Current Season')).toBeVisible();
    const rows = page.getByRole('table').first().locator('tbody tr:visible');
    await expect(rows.filter({ hasText: 'tuser' })).toHaveCount(1);
  });

  test('marks players with <10 ranked matches as Unranked, in a closed list', async ({
    page,
  }) => {
    // Seed players with fewer than 10 matches in the current season appear in
    // the standings' Unranked list. Home lists ranked players only.
    await gotoAuthed(page, STANDINGS_URL);
    const disclosure = page.locator('details:has(#unranked-heading)');
    const toggle = disclosure.locator('summary');
    await expect(toggle).toHaveText(
      /^Unranked · \d+ players\s*Play 10 matches to place$/
    );
    await expect(disclosure).not.toHaveAttribute('open');
    // Still a heading, so heading navigation finds it.
    await expect(
      page.getByRole('heading', { name: /^Unranked · \d+ players$/ })
    ).toBeVisible();
    const list = page.locator('#unranked-list');
    await expect(list).toBeHidden();

    await toggle.click();
    await expect(disclosure).toHaveAttribute('open');
    await expect(list.getByRole('listitem').first()).toBeVisible();
    const count = Number(
      (await toggle.innerText()).match(/Unranked · (\d+) players/)![1]
    );
    await expect(list.getByRole('listitem')).toHaveCount(count);
  });

  test('toggling MMR shows the (+/−delta) inline next to each player', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);

    const firstCard = page
      .locator('.flex.flex-1.flex-col.items-stretch > div.bg-card')
      .first();
    // MMR off by default — no "(+...)" delta text yet.
    await expect(
      firstCard.locator('span', { hasText: /\(\+\d+\)|\(-\d+\)/ })
    ).toHaveCount(0);

    await page.getByRole('switch', { name: 'MMR:' }).click();

    await expect(
      firstCard.locator('span', { hasText: /\(\+\d+\)|\(-\d+\)/ }).first()
    ).toBeVisible();
  });

  test('clicking a leaderboard row opens the user stats modal', async ({
    page,
  }) => {
    await page.goto(LEAGUE_URL);

    // The first row is someone else: Home centres on the test user, so they
    // sit in the middle.
    const firstRow = page
      .getByRole('table')
      .first()
      .locator('tbody tr')
      .first();
    const leader = await firstRow
      .locator('td')
      .nth(1)
      .locator('span')
      .first()
      .textContent();
    await firstRow.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(leader!, { exact: true })).toBeVisible();
    await expect(dialog.getByText('Rank')).toBeVisible();
    await expect(dialog.getByText('# Wins')).toBeVisible();
  });

  test('sparklines draw after navigating away and back', async ({ page }) => {
    // Regression: a sparkline that mounted while the history was still
    // loading never drew its line. Holding the history back guarantees the
    // leaderboard mounts first.
    await page.route(isRatingHistoryRoute, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      await route.continue();
    });

    await page.goto(LEAGUE_URL);
    const sparklines = page
      .getByRole('table')
      .first()
      .locator(SPARKLINE_SELECTOR);
    const line = page.locator(SPARKLINE_LINE_SELECTOR);
    await expect(sparklines.locator(line).first()).toBeAttached();

    await page.locator('nav a[href$="/matchmaking"]').click();
    await page.waitForURL(/\/matchmaking$/);
    // Going back before the leaderboard unmounts would not remount it.
    await expect(sparklines).toHaveCount(0);
    await page.goBack();
    await page.waitForURL(new RegExp(`${LEAGUE_URL}$`));

    await expect(sparklines.locator(line).first()).toBeAttached();
    await expect(sparklines.filter({ hasNot: line })).toHaveCount(0);
  });

  test('opening the report-match modal loads recent matches', async ({
    page,
  }) => {
    // Regression: the v3 rewrite of the modal pointed its client-side
    // fetch at /api/v3/... but no app endpoint matched that path,
    // so every open showed "Failed to load matches".
    await page.goto(LEAGUE_URL);

    await page.getByRole('button', { name: 'Report match' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Report a match')).toBeVisible();

    await expect(dialog.getByText('Failed to load matches')).toHaveCount(0);

    // The seed has 15 current-season matches; at least one match button
    // must render inside the dialog.
    await expect(
      dialog.locator('button.w-full.rounded-lg.border').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

/** psql is the sanctioned arrange/inspect channel for e2e (see e2e/README.md). */
function psql(sql: string): string {
  return execFileSync(
    'psql',
    [
      '-h',
      process.env.E2E_DB_HOST ?? 'localhost',
      '-p',
      process.env.E2E_DB_PORT ?? '5433',
      '-U',
      process.env.E2E_DB_USER ?? 'postgres',
      '-d',
      process.env.E2E_DB_NAME ?? 'mmr_project',
      '-tAc',
      sql,
    ],
    {
      env: {
        ...process.env,
        PGPASSWORD: process.env.E2E_DB_PASS ?? 'this_is_a_hard_password1337',
      },
    }
  )
    .toString()
    .trim();
}

// The seed's league player for the signed-in test user in test-league.
const MY_LEAGUE_PLAYER = '66666666-6666-6666-6666-666666666601';

/**
 * Runs `body` with the test user's season rating set to `mmr`, then puts it
 * back. The leaderboard reads a player's season MMR from their latest rating
 * history row, ordered as `V3LeaderboardService` orders it.
 */
async function withMyMmr(mmr: number, body: () => Promise<void>) {
  const [id, before] = psql(
    `SELECT rh.id, rh.mmr FROM rating_histories rh
       JOIN matches m ON m.id = rh.match_id
      WHERE rh.league_player_id = '${MY_LEAGUE_PLAYER}'
      ORDER BY m.played_at DESC, m.recorded_at DESC, m.created_at DESC, m.id DESC
      LIMIT 1`
  ).split('|');
  psql(`UPDATE rating_histories SET mmr = ${mmr} WHERE id = '${id}'`);
  try {
    await body();
  } finally {
    psql(`UPDATE rating_histories SET mmr = ${before} WHERE id = '${id}'`);
  }
}

/**
 * Runs `body` with `count` extra ranked players in test-league's current
 * season, then removes them. Each plays 10 matches (the ranked threshold);
 * every id starts with a fixed prefix so cleanup finds exactly these rows.
 */
async function withExtraRankedPlayers(
  count: number,
  body: () => Promise<void>
) {
  const org = '11111111-1111-1111-1111-111111111111';
  const league = '22222222-2222-2222-2222-222222222222';
  const id = (prefix: string, n: string) =>
    `('${prefix}-0000-4000-8000-' || lpad(to_hex(${n}), 12, '0'))::uuid`;
  const cleanup = () =>
    psql(`
      DELETE FROM rating_histories WHERE id::text LIKE 'e6e6e6e6-%';
      DELETE FROM match_team_players WHERE id::text LIKE 'e5e5e5e5-%';
      DELETE FROM match_teams WHERE id::text LIKE 'e4e4e4e4-%';
      DELETE FROM matches WHERE id::text LIKE 'e3e3e3e3-%';
      DELETE FROM league_players WHERE id::text LIKE 'e2e2e2e2-%';
      DELETE FROM organization_memberships WHERE id::text LIKE 'e1e1e1e1-%';`);
  cleanup();
  psql(`
    INSERT INTO organization_memberships
      (id, display_name, username, role, status, created_at, organization_id)
    SELECT ${id('e1e1e1e1', 'n')}, 'Paging Player ' || n, 'pg' || n, m.role, m.status, now(), '${org}'
      FROM generate_series(0, ${count - 1}) n,
           (SELECT role, status FROM organization_memberships WHERE username = 'irin') m;
    INSERT INTO league_players
      (id, league_id, organization_membership_id, mmr, mu, sigma, created_at, organization_id)
    SELECT ${id('e2e2e2e2', 'n')}, '${league}', ${id('e1e1e1e1', 'n')}, 1000, 25, 8.333, now(), '${org}'
      FROM generate_series(0, ${count - 1}) n;
    -- Match n: players n..n+4 beat n+5..n+9 (mod count), so each plays 10.
    INSERT INTO matches
      (id, league_id, season_id, source, created_by_membership_id, played_at, recorded_at, created_at, organization_id)
    SELECT ${id('e3e3e3e3', 'n')}, '${league}', s.id, x.source, x.created_by_membership_id,
           s.starts_at + n * interval '1 minute', s.starts_at + n * interval '1 minute', now(), '${org}'
      FROM generate_series(0, ${count - 1}) n,
           (SELECT m.season_id AS id, se.starts_at FROM rating_histories rh
              JOIN matches m ON m.id = rh.match_id JOIN seasons se ON se.id = m.season_id
             WHERE rh.league_player_id = '${MY_LEAGUE_PLAYER}'
             ORDER BY m.played_at DESC LIMIT 1) s,
           (SELECT source, created_by_membership_id FROM matches WHERE league_id = '${league}' LIMIT 1) x;
    INSERT INTO match_teams (id, league_id, match_id, index, score, is_winner, created_at, organization_id)
    SELECT ${id('e4e4e4e4', 'n * 2 + t')}, '${league}', ${id('e3e3e3e3', 'n')}, t, 10 - t * 5, t = 0, now(), '${org}'
      FROM generate_series(0, ${count - 1}) n, generate_series(0, 1) t;
    INSERT INTO match_team_players (id, league_id, match_team_id, league_player_id, index, created_at, organization_id)
    SELECT ${id('e5e5e5e5', 'n * 10 + t * 5 + k')}, '${league}', ${id('e4e4e4e4', 'n * 2 + t')},
           ${id('e2e2e2e2', `(n + t * 5 + k) % ${count}`)}, k, now(), '${org}'
      FROM generate_series(0, ${count - 1}) n, generate_series(0, 1) t, generate_series(0, 4) k;
    -- One rating row each is enough: the leaderboard reads a player's latest.
    INSERT INTO rating_histories (id, league_player_id, match_id, mmr, mu, sigma, delta, created_at, organization_id)
    SELECT ${id('e6e6e6e6', 'n')}, ${id('e2e2e2e2', 'n')}, ${id('e3e3e3e3', 'n')}, 900 - n, 25, 8.333, 0, now(), '${org}'
      FROM generate_series(0, ${count - 1}) n;`);
  try {
    await body();
  } finally {
    cleanup();
  }
}

test.describe('Leaderboard around you', () => {
  const homeRows = (page: Page) =>
    page
      .locator('section[aria-labelledby="home-leaderboard-heading"]')
      .locator('tbody tr');
  const standingsRows = (page: Page) =>
    page.getByRole('table').first().locator('tbody tr');
  const gap = (page: Page) => page.getByTestId('standings-gap');

  test('home slides the window down when you are at the top', async ({
    page,
  }) => {
    await withMyMmr(99_999, async () => {
      await gotoAuthed(page, LEAGUE_URL);
      const rows = homeRows(page);
      await expect(rows).toHaveCount(7);
      await expect(rows.first()).toHaveAttribute('aria-current', 'true');
      await expect(rows.first().locator('td').first()).toHaveText('1');
    });
  });

  test('home slides the window up when you are at the bottom', async ({
    page,
  }) => {
    await withMyMmr(-99_999, async () => {
      await gotoAuthed(page, LEAGUE_URL);
      const rows = homeRows(page);
      await expect(rows).toHaveCount(7);
      await expect(rows.last()).toHaveAttribute('aria-current', 'true');
    });
  });

  test('the standings show everyone on one page, with you in place', async ({
    page,
  }) => {
    await gotoAuthed(page, STANDINGS_URL);
    const rows = standingsRows(page);
    await expect(rows.filter({ hasText: 'tuser' })).toHaveAttribute(
      'aria-current',
      'true'
    );
    await expect(gap(page)).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Pages' })).toHaveCount(
      0
    );
    await expect(page.getByRole('button', { name: /^Show all/ })).toHaveCount(
      0
    );
  });

  test('search finds players by name, keeps their ranks and pins your row', async ({
    page,
  }) => {
    await gotoAuthed(page, STANDINGS_URL);
    const rows = standingsRows(page);
    const top = await rows.first().locator('td').first().innerText();
    // The handle alone, without the streak icon beside it.
    const leader = await rows.first().locator('a > span').first().innerText();

    const search = page.getByRole('searchbox', { name: 'Search players' });
    // Typing before hydration enables the box would send the keys elsewhere.
    await expect(search).toBeEnabled();
    await search.pressSequentially(leader);
    await expect(page.getByText('1 player found')).toBeAttached();
    // The leader keeps their rank; you stay visible below a gap.
    await expect(rows.first().locator('td').first()).toHaveText(top);
    await expect(rows.first()).toContainText(leader);
    await expect(gap(page)).toBeVisible();
    await expect(rows.last()).toHaveAttribute('aria-current', 'true');
    await expect(page.getByText(/^1 of \d+ players$/)).toBeVisible();

    await search.fill('no such player');
    await expect(
      page.getByText('No ranked player matches “no such player”.')
    ).toBeVisible();
    await expect(
      page.getByText('No ranked player matches', { exact: true })
    ).toBeAttached();
    await expect(rows.last()).toHaveAttribute('aria-current', 'true');

    await search.fill('');
    await expect(gap(page)).toHaveCount(0);
    await expect(page.getByText(/ of \d+ players$/)).toHaveCount(0);
  });

  test('the standings page through 100 players at a time, pinning your row', async ({
    page,
  }) => {
    await withExtraRankedPlayers(70, () =>
      withMyMmr(-99_999, async () => {
        await gotoAuthed(page, STANDINGS_URL);
        const rows = standingsRows(page);
        const pager = page.getByRole('navigation', { name: 'Pages' });
        await expect(pager).toContainText('Page 1 of 2');
        const total = Number(
          (await page.getByText(/^Showing 1–100 of \d+$/).innerText()).match(
            /of (\d+)/
          )![1]
        );
        expect(total).toBeGreaterThan(100);

        // Page 1: 100 rows, the gap, then you, last of everyone.
        await expect(rows).toHaveCount(100 + 2);
        await expect(gap(page)).toBeVisible();
        await expect(rows.last()).toHaveAttribute('aria-current', 'true');
        await expect(rows.last().locator('td').first()).toHaveText(
          String(total)
        );

        // Page 2: the rest, with you in place and nothing pinned.
        await pager.getByRole('button', { name: 'Next' }).click();
        await expect(pager).toContainText('Page 2 of 2');
        await expect(rows).toHaveCount(total - 100);
        // Next is now disabled, so focus moves to the new page's top.
        await expect(page.locator(':focus table')).toHaveCount(1);

        // Spaces alone match everyone, so they keep the page.
        const search = page.getByRole('searchbox', { name: 'Search players' });
        await search.fill(' ');
        await expect(pager).toContainText('Page 2 of 2');
        await expect(gap(page)).toHaveCount(0);
        await expect(rows.last()).toHaveAttribute('aria-current', 'true');
        await expect(
          pager.getByRole('button', { name: 'Next' })
        ).toBeDisabled();

        // A search starts at page 1, and so does clearing it again.
        await search.fill('no such player');
        await search.fill('');
        await expect(pager).toContainText('Page 1 of 2');

        await pager.getByRole('button', { name: 'Next' }).click();
        await pager.getByRole('button', { name: 'Previous' }).click();
        await expect(pager).toContainText('Page 1 of 2');
        await expect(rows).toHaveCount(100 + 2);

        // On a phone the podium hides rows #1-#3, never your pinned row.
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(rows.last()).toBeVisible();
        await expect(rows.first()).toBeHidden();
      })
    );
  });

  test('a keyboard user keeps their place on the pager between middle pages', async ({
    page,
  }) => {
    await withExtraRankedPlayers(170, async () => {
      await gotoAuthed(page, STANDINGS_URL);
      const pager = page.getByRole('navigation', { name: 'Pages' });
      await expect(pager).toContainText('Page 1 of 3');
      const next = pager.getByRole('button', { name: 'Next' });
      // focus() doesn't wait for hydration to enable the button.
      await expect(next).toBeEnabled();
      await next.focus();
      await page.keyboard.press('Enter');

      // Page 2 of 3: Next stays enabled, focused and in view, and the new
      // page number is announced.
      await expect(pager).toContainText('Page 2 of 3');
      await expect(next).toBeFocused();
      await expect(next).toBeInViewport();
      const status = pager.getByText('Page 2 of 3');
      await expect(status).toHaveAttribute('aria-live', 'polite');
      // The whole phrase, not just the digit that changed.
      await expect(status).toHaveAttribute('aria-atomic', 'true');

      // Pressing on to the last page disables Next, so focus moves to the top.
      await page.keyboard.press('Enter');
      await expect(pager).toContainText('Page 3 of 3');
      await expect(page.locator(':focus table')).toHaveCount(1);

      // Back from the short last page: the table grows above the pager, and
      // the button pressed still stays in view.
      const previous = pager.getByRole('button', { name: 'Previous' });
      await previous.focus();
      await page.keyboard.press('Enter');
      await expect(pager).toContainText('Page 2 of 3');
      await expect(previous).toBeFocused();
      await expect(previous).toBeInViewport();
    });
  });

  test('an unranked player sees the unranked list open, with their row marked', async ({
    page,
  }) => {
    // Hand the signed-in user to an unranked seed player's membership.
    const mine = psql(
      `SELECT organization_membership_id FROM league_players WHERE id = '${MY_LEAGUE_PLAYER}'`
    );
    const user = psql(
      `SELECT user_id FROM organization_memberships WHERE id = '${mine}'`
    );
    const theirs = psql(
      `SELECT id FROM organization_memberships
        WHERE username = 'irin' AND organization_id = '11111111-1111-1111-1111-111111111111'`
    );
    expect(theirs).toMatch(/^[0-9a-f-]{36}$/);
    try {
      // Inside the try: if the second update fails, the finally still
      // restores the test user's membership for the rest of the suite.
      psql(
        `UPDATE organization_memberships SET user_id = NULL WHERE id = '${mine}'`
      );
      psql(
        `UPDATE organization_memberships SET user_id = '${user}' WHERE id = '${theirs}'`
      );
      await gotoAuthed(page, STANDINGS_URL);
      await expect(
        page.locator('details:has(#unranked-heading)')
      ).toHaveAttribute('open');
      const me = page.locator('#unranked-list li[aria-current="true"]');
      await expect(me).toBeVisible();
      await expect(me).toContainText('irin');
      await expect(gap(page)).toHaveCount(0);

      // With no rank, home shows the top of the board.
      await gotoAuthed(page, LEAGUE_URL);
      await expect(homeRows(page).first().locator('td').first()).toHaveText(
        '1'
      );
      await expect(
        page.locator(
          'section[aria-labelledby="home-leaderboard-heading"] tbody tr[aria-current="true"]'
        )
      ).toHaveCount(0);
    } finally {
      psql(
        `UPDATE organization_memberships SET user_id = NULL WHERE id = '${theirs}'`
      );
      psql(
        `UPDATE organization_memberships SET user_id = '${user}' WHERE id = '${mine}'`
      );
    }
  });
});
