import playwright from '../../frontend/node_modules/@playwright/test/index.js';

const { test, expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

interface ActiveElementSummary {
  tag: string;
  ariaLabel: string | null;
  href: string | null;
}

async function activeElementSummary(
  page: import('../../frontend/node_modules/@playwright/test/index.js').Page
) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    return {
      tag: element?.tagName.toLowerCase() ?? '',
      ariaLabel: element?.getAttribute('aria-label') ?? null,
      href: element?.getAttribute('href') ?? null,
    };
  });
}

for (const [app, port] of [
  ['reference', process.env.E2E_PORT ?? '5180'],
  ['beta', process.env.PARITY_BETA_PORT ?? '5181'],
] as const) {
  test(`${app}: header menus close and move past the trigger on Tab`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({ ...info.project.use });
    const page = await context.newPage();
    const url = `http://localhost:${port}/test-org/test-league`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname !== '/test-org/test-league') {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }

    const switcher = page.getByRole('button', {
      name: 'Switch organization or league',
    });
    const settings = page.getByRole('button', { name: /^Settings menu/ });

    await switcher.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'Test Org', exact: true })
    ).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(settings).toBeFocused();

    await context.close();
  });

  test(`${app}: Escape closes a header menu and returns focus to its trigger`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({ ...info.project.use });
    const page = await context.newPage();
    const url = `http://localhost:${port}/test-org/test-league`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname !== '/test-org/test-league') {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }

    const settings = page.getByRole('button', { name: /^Settings menu/ });
    await settings.focus();
    await settings.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('menu')).toBeHidden();
    await expect(settings).toBeFocused();
    await context.close();
  });
}

test('reverse Tab from a header menu matches reference focus', async ({
  browser,
}, info) => {
  const fingerprints: ActiveElementSummary[] = [];
  for (const port of [
    process.env.E2E_PORT ?? '5180',
    process.env.PARITY_BETA_PORT ?? '5181',
  ]) {
    const context = await browser.newContext({ ...info.project.use });
    const page = await context.newPage();
    const url = `http://localhost:${port}/test-org/test-league`;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (new URL(page.url()).pathname !== '/test-org/test-league') {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }

    await page.getByRole('button', { name: /^Settings menu/ }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('menu')).toBeHidden();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    fingerprints.push(await activeElementSummary(page));
    await context.close();
  }

  const switcher = {
    tag: 'button',
    ariaLabel: 'Switch organization or league',
    href: null,
  };
  expect(fingerprints).toEqual([switcher, switcher]);
});
