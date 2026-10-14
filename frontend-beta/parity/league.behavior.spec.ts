import playwright, {
  type Browser,
  type TestInfo,
} from '../../frontend/node_modules/@playwright/test/index.js';

const { expect, test } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const LEAGUE = '/test-org/test-league';

async function openPage(
  browser: Browser,
  info: TestInfo,
  port: string,
  path: string
) {
  const context = await browser.newContext({ ...info.project.use });
  const page = await context.newPage();
  const url = `http://localhost:${port}${path}`;
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  if (new URL(page.url()).pathname !== LEAGUE) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
  }
  await expect(page).toHaveURL(url);
  return { context, page };
}

for (const [app, port] of [
  ['reference', process.env.E2E_PORT ?? '5180'],
  ['beta', process.env.PARITY_BETA_PORT ?? '5181'],
] as const) {
  test(`${app}: an explicitly empty season is not the current season`, async ({
    browser,
  }, info) => {
    const { context, page } = await openPage(
      browser,
      info,
      port,
      `${LEAGUE}?season=`
    );

    expect(new URL(page.url()).searchParams.has('season')).toBe(true);
    await expect(
      page.getByRole('heading', { name: 'Recent Matches', exact: true })
    ).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'MMR:' })).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Report match', exact: true })
    ).toHaveCount(0);
    await context.close();
  });

  test(`${app}: authenticated pages keep the reference document title`, async ({
    browser,
  }, info) => {
    const { context, page } = await openPage(browser, info, port, LEAGUE);
    await expect(
      page.getByRole('heading', { name: 'Recent Matches', exact: true })
    ).toBeVisible();
    await expect(page).toHaveTitle('');
    await context.close();
  });
}
