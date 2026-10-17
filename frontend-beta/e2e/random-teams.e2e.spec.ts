// The touch draw on a phone: it takes the whole screen, keeps the queue card
// away, and numbers the teams. Touches go through CDP because Playwright's
// touchscreen can only tap one point at a time.
import { test, expect, type CDPSession, type Page } from '@playwright/test';
import { gotoAuthed } from './helpers';

const LEAGUE_HOME = '/test-org/test-league';

// Two queued players, so the queue card has something to show wherever it is
// allowed to appear.
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

const queueCard = (page: Page) => page.getByRole('region', { name: 'Queue' });
const surface = (page: Page) => page.getByLabel('Touch randomizer surface');
const bottomBar = (page: Page) =>
  page.getByRole('navigation', { name: 'Primary' });

test.describe('Teams on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  async function openTouchDraw(page: Page, from?: string) {
    const client = await page.context().newCDPSession(page);
    // Coarse pointer and no hover, so /random opens on the touch draw.
    await client.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'hover', value: 'none' },
        { name: 'pointer', value: 'coarse' },
      ],
    });
    if (from) await gotoAuthed(page, from);
    await gotoAuthed(page, '/random');
    await expect(surface(page)).toBeVisible();
    return client;
  }

  async function placeFingers(page: Page, client: CDPSession) {
    const box = (await surface(page).boundingBox())!;
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        [0.27, 0.3],
        [0.73, 0.3],
        [0.27, 0.72],
        [0.73, 0.72],
      ].map(([fx, fy], id) => ({
        id,
        x: Math.round(box.x + box.width * fx),
        y: Math.round(box.y + box.height * fy),
      })),
    });
  }

  test('the draw takes the whole screen, without the queue card', async ({
    page,
  }) => {
    await stubQueue(page);
    await openTouchDraw(page, LEAGUE_HOME);

    await expect(bottomBar(page)).toBeHidden();
    await expect(page.getByLabel('Settings menu')).toBeHidden();
    await expect(queueCard(page)).toHaveCount(0);
    const box = (await surface(page).boundingBox())!;
    expect(box.y + box.height).toBe(844);
  });

  test('a draw numbers the teams 1 and 2, and Go again clears it', async ({
    page,
  }) => {
    const client = await openTouchDraw(page);
    await placeFingers(page, client);

    await expect(page.getByText('Team 1 vs Team 2')).toBeVisible({
      timeout: 10_000,
    });
    const markers = surface(page).locator('[data-marker]');
    await expect(markers).toHaveCount(4);
    expect((await markers.allTextContents()).sort()).toEqual([
      '1',
      '1',
      '2',
      '2',
    ]);

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.getByRole('button', { name: 'Go again' }).click();
    await expect(markers).toHaveCount(0);
    await expect(page.getByText('0 of 4 fingers')).toBeVisible();
  });

  test('Names brings the app bars back', async ({ page }) => {
    await openTouchDraw(page);
    await page.getByRole('tab', { name: 'Names' }).click();

    await expect(bottomBar(page)).toBeVisible();
    await expect(page.getByLabel('Settings menu')).toBeVisible();
  });

  test('the mode tabs switch from the keyboard', async ({ page }) => {
    await openTouchDraw(page);
    const touch = page.getByRole('tab', { name: 'Touch' });
    const names = page.getByRole('tab', { name: 'Names' });
    await expect(touch).toHaveAttribute('aria-selected', 'true');

    await touch.focus();
    await page.keyboard.press('ArrowRight');
    await expect(names).toBeFocused();
    // Focus alone doesn't switch modes mid-draw; Enter does.
    await expect(surface(page)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(names).toHaveAttribute('aria-selected', 'true');
    await expect(surface(page)).toHaveCount(0);
    await expect(
      page
        .getByRole('tabpanel')
        .getByRole('heading', { name: "Who's playing?" })
    ).toBeVisible();
  });

  test('closing goes back to where the draw was opened from', async ({
    page,
  }) => {
    await openTouchDraw(page, LEAGUE_HOME);
    await page.getByRole('link', { name: 'Close random teams' }).click();

    await expect(page).toHaveURL(LEAGUE_HOME);
    await expect(bottomBar(page)).toBeVisible();
  });
});

test('desktop Teams has no queue card either', async ({ page }) => {
  await stubQueue(page);
  // Control: the sidebar shows the card on other pages.
  await gotoAuthed(page, LEAGUE_HOME);
  await expect(queueCard(page)).toBeVisible();

  // Settled, so the card would have rendered by now if it were allowed to.
  await gotoAuthed(page, '/random');
  await expect(
    page.getByRole('heading', { name: 'Random teams' })
  ).toBeVisible();
  await expect(queueCard(page)).toHaveCount(0);
});
