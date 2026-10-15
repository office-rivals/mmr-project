import { expect, test, type Page, type Response } from '@playwright/test';
import { gotoAuthed } from './helpers';

const SUBMIT = '/test-org/test-league/submit';

test.use({ viewport: { width: 390, height: 844 } });

async function pickPlayer(page: Page, displayName: string) {
  const input = page.locator('input[placeholder="Filter..."]').first();
  await input.fill(displayName);
  await page
    .locator('button', { hasText: new RegExp(displayName) })
    .first()
    .click();
}

test('progressive form steps do not refetch the shell or lose selections', async ({
  page,
}) => {
  await gotoAuthed(page, SUBMIT);
  await pickPlayer(page, 'Alice Anderson');
  await pickPlayer(page, 'Bob Brown');
  await pickPlayer(page, 'Carol Carter');
  await pickPlayer(page, 'Dave Davies');

  let stepRpcRequests = 0;
  await page.route(
    (url) => url.pathname.startsWith('/_serverFn/'),
    (route) => {
      stepRpcRequests++;
      return route.abort();
    }
  );

  await page.getByRole('button', { name: /We won/ }).click();
  await expect(page).toHaveURL(SUBMIT);
  const theirScore = page.getByRole('heading', {
    name: 'What was their score?',
  });
  await expect(theirScore).toBeInViewport();

  await page.getByRole('button', { name: /They won/ }).click();
  await expect(page).toHaveURL(SUBMIT);
  const yourScore = page.getByRole('heading', {
    name: 'What was your score?',
  });
  await expect(yourScore).toBeInViewport();

  await page.getByRole('button', { name: '5', exact: true }).click();
  await expect(page).toHaveURL(SUBMIT);
  const preview = page.locator('#submit-step');
  await expect(preview).toBeInViewport();
  await expect(preview.getByText('alia', { exact: true })).toBeVisible();
  await expect(preview.getByText('dada', { exact: true })).toBeVisible();
  await expect(preview.getByText('10', { exact: true })).toBeVisible();
  await expect(preview.getByText('5', { exact: true })).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  expect(stepRpcRequests).toBe(0);
});

test('an expired session redirects a client navigation through server RPC', async ({
  page,
}) => {
  await gotoAuthed(page, SUBMIT);
  await page.context().clearCookies();
  const responses: Response[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/_serverFn/')) {
      responses.push(response);
    }
  });

  await page.locator('a[href="/random"]').click();
  await expect(page).toHaveURL('/login');

  const payloads = await Promise.all(
    responses.map(async (response) => {
      try {
        return await response.json();
      } catch {
        return null;
      }
    })
  );
  expect(payloads).toContainEqual(
    expect.objectContaining({ href: '/login', isSerializedRedirect: true })
  );
});

test('the bottom bar sits on its own, not inside the fixed top bar', async ({
  page,
}) => {
  // A fixed element nested inside another fixed one can trail the scroll.
  await gotoAuthed(page, '/test-org/test-league');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toBeVisible();
  const box = await nav.boundingBox();
  expect(box && box.y + box.height).toBe(844);
  const fixedAncestor = await nav.evaluate((element) => {
    for (let node = element.parentElement; node; node = node.parentElement) {
      if (getComputedStyle(node).position === 'fixed') return node.tagName;
    }
    return null;
  });
  expect(fixedAncestor).toBeNull();
});
