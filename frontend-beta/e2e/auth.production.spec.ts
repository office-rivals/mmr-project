import { expect, test } from '@playwright/test';

test('production serves authenticated HTML without hydration and rejects forged form origins', async ({
  page,
  browser,
}) => {
  await page.goto('/test-org/test-league');
  await expect(
    page.getByRole('heading', { name: 'Leaderboard', exact: true }).first()
  ).toBeVisible();
  await page.waitForLoadState('networkidle');
  const context = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    const nativePage = await context.newPage();
    const response = await nativePage.goto(
      new URL('/test-org/test-league', page.url()).href
    );
    expect(response?.status()).toBe(200);
    await expect(
      nativePage
        .getByRole('heading', { name: 'Leaderboard', exact: true })
        .first()
    ).toBeVisible();
    await expect(nativePage.getByRole('table').first()).toContainText('tuser');
    await nativePage.goto(new URL('/test-org/settings', page.url()).href);
    const saved = await nativePage.request.post(nativePage.url(), {
      headers: { origin: new URL(page.url()).origin },
      form: {
        _action: 'update',
        name: await nativePage.locator('input[name="name"]').inputValue(),
        slug: await nativePage.locator('input[name="slug"]').inputValue(),
      },
      maxRedirects: 0,
    });
    expect(saved.status()).toBe(303);
    const rejected = await nativePage.request.post(
      new URL('/test-org/settings', page.url()).href,
      {
        headers: {
          origin: 'https://attacker.example',
          'x-forwarded-host': 'attacker.example',
          'x-forwarded-proto': 'https',
        },
        form: { name: 'Must not be saved' },
        maxRedirects: 0,
      }
    );
    expect(rejected.status()).toBe(403);
  } finally {
    await context.close();
  }
});

test('production health and assets are public and typed correctly', async ({
  playwright: pw,
  baseURL,
}) => {
  const request = await pw.request.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const health = await request.get('/health');
    expect(health.status()).toBe(200);
    expect(health.headers()['cache-control']).toBe('no-store');
    const manifest = await request.get('/site.webmanifest');
    expect(manifest.status()).toBe(200);
    expect(manifest.headers()['content-type']).toContain(
      'application/manifest+json'
    );
    const protectedPage = await request.get('/settings', { maxRedirects: 0 });
    expect(protectedPage.status()).toBe(303);
    expect(protectedPage.headers().location).toBe('/login');
  } finally {
    await request.dispose();
  }
});

for (const [locale, timezoneId] of [
  ['en-US', 'America/Los_Angeles'],
  ['da-DK', 'Europe/Copenhagen'],
  ['en-US', 'Pacific/Kiritimati'],
]) {
  test(`UTC server hydrates in ${locale} / ${timezoneId}`, async ({
    browser,
    baseURL,
  }, info) => {
    const context = await browser.newContext({
      storageState: info.project.use.storageState,
      locale,
      timezoneId,
    });
    const errors: string[] = [];
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      for (const route of [
        '/test-org/test-league',
        '/test-org/test-league/player/66666666-6666-6666-6666-666666666601',
        '/admin/test-org/leagues/test-league',
        '/admin/test-org/leagues/test-league/matches',
        '/admin/test-org/leagues/test-league/match-flags',
        '/admin/test-org/leagues/test-league/seasons',
        '/admin/test-org/members',
        '/settings',
      ]) {
        await page.goto(new URL(route, baseURL).href);
        await page.waitForLoadState('networkidle');
        expect(new URL(page.url()).pathname).toBe(route);
        await expect(page.locator('main')).toBeVisible();
        expect(errors, route).toEqual([]);
        const timestamp = page.locator('time[datetime]').first();
        if (await timestamp.count()) {
          const instant = await timestamp.getAttribute('datetime');
          await expect(timestamp).toHaveText(
            new Intl.DateTimeFormat(locale, {
              timeZone: timezoneId,
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(instant!))
          );
        }
      }
    } finally {
      await context.close();
    }
  });
}

test('sign-out stays on this application and protects subsequent requests', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/test-org/test-league');
  await page.waitForLoadState('networkidle');
  const origin = new URL(page.url()).origin;
  await page.getByRole('button', { name: /^Settings menu/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/login`);
  await expect(page.locator('input[name=identifier]')).toBeVisible();
  await page.goto('/settings');
  await expect(page).toHaveURL(`${origin}/login`);
  expect(errors).toEqual([]);
});
