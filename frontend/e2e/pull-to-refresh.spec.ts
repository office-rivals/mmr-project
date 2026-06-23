import { test, expect, type CDPSession, type Page } from '@playwright/test';

// Pull-to-refresh is a window-level touch gesture gated to installed-PWA mode.
// We can't install a PWA in automation, so we drive the component's own
// standalone signal (navigator.standalone, which isStandaloneMode() checks) via
// an init script, and dispatch real touch input through Chromium CDP
// (Input.dispatchTouchEvent).

test.use({ hasTouch: true });

const LEAGUE = '/test-org/test-league';
const indicator = (page: Page) => page.locator('[role="status"].fixed');

// Make isStandaloneMode() return true before any page script runs.
async function markStandalone(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'standalone', {
      value: true,
      configurable: true,
    });
  });
}

async function cdp(page: Page) {
  const client = await page.context().newCDPSession(page);
  // Coarse pointer / no hover so /random renders its touch surface.
  await client.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'hover', value: 'none' },
      { name: 'pointer', value: 'coarse' },
    ],
  });
  return client;
}

async function pull(
  client: CDPSession,
  { x = 180, fromY = 90, toY = 380, steps = 14, release = true } = {}
) {
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: fromY }],
  });
  for (let i = 1; i <= steps; i++) {
    const y = Math.round(fromY + ((toY - fromY) * i) / steps);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y }],
    });
  }
  if (release) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  }
}

async function waitForShell(page: Page) {
  await expect(page.getByLabel('Settings menu')).toBeVisible();
  await page.waitForTimeout(400); // let the layout's onMount attach listeners
}

test('does NOT attach the gesture outside standalone (browser tab)', async ({
  page,
}) => {
  const client = await cdp(page); // note: NOT marked standalone
  await page.goto(LEAGUE);
  await waitForShell(page);

  expect(await page.evaluate(() => !!navigator.standalone)).toBe(false);
  await pull(client, { release: false });
  await expect(indicator(page)).toHaveCount(0);
  await pull(client); // release
  await expect(indicator(page)).toHaveCount(0);
});

test('standalone: pull past threshold shows the indicator and refetches data', async ({
  page,
}) => {
  await markStandalone(page);
  const client = await cdp(page);
  await page.goto(LEAGUE);
  await waitForShell(page);
  expect(await page.evaluate(() => navigator.standalone)).toBe(true);

  // invalidateAll() re-runs SvelteKit load functions -> observable as a
  // __data.json refetch.
  const refetch = page.waitForRequest((r) => r.url().includes('__data.json'), {
    timeout: 10_000,
  });

  await pull(client, { release: false }); // hold the pull
  await expect(indicator(page)).toBeVisible();

  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  }); // release past threshold -> commit
  await refetch; // throws if invalidateAll never fired
  await expect(indicator(page)).toHaveCount(0); // resets to idle
});

test('standalone: /random touch surface is opted out (with positive control)', async ({
  page,
}) => {
  await markStandalone(page);
  const client = await cdp(page);
  await page.goto('/random');

  const surface = page.getByLabel('Touch randomizer surface');
  await expect(surface).toBeVisible();
  expect(await page.evaluate(() => navigator.standalone)).toBe(true);
  await page.waitForTimeout(400);

  // A long downward drag on the randomizer surface must NOT arm pull-to-refresh.
  await pull(client, { x: 180, fromY: 220, toY: 520, release: false });
  await expect(indicator(page)).toHaveCount(0);
  await pull(client, { x: 180, fromY: 220, toY: 520 }); // release
  await expect(indicator(page)).toHaveCount(0);

  // Positive control: the SAME standalone context DOES arm the gesture on a
  // normal page — proving the no-show above was the opt-out, not a dead gesture.
  await page.goto(LEAGUE);
  await waitForShell(page);
  await pull(client, { release: false });
  await expect(indicator(page)).toBeVisible();
  await pull(client); // release
});
