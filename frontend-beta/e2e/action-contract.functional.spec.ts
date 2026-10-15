import { expect, test } from '@playwright/test';
import { gotoAuthed } from './helpers';

const MEMBERS = '/admin/test-org/members';
const MATCHES = '/admin/test-org/leagues/test-league/matches';
const FLAGS = '/admin/test-org/leagues/test-league/match-flags';

test.describe('native admin forms', () => {
  test.use({ javaScriptEnabled: false });

  test('member roles retain a native POST contract', async ({ page }) => {
    await page.goto(MEMBERS);

    const member = page
      .getByText('Alice Anderson', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    const select = member.locator('select[name="role"]');
    const form = select.locator('xpath=ancestor::form');
    await expect(form).toHaveAttribute('method', 'post');
    await expect(form).toHaveAttribute('action', MEMBERS);

    const membershipId = await form
      .locator('input[name="membershipId"]')
      .inputValue();
    const originalRole = await select.inputValue();
    const nextRole = originalRole === 'Member' ? 'Moderator' : 'Member';
    const postRole = (role: string) =>
      page.request.post(MEMBERS, {
        headers: { origin: new URL(page.url()).origin },
        form: {
          _action: 'updateRole',
          membershipId,
          role,
        },
        maxRedirects: 0,
      });

    try {
      const response = await postRole(nextRole);
      expect(response.status()).toBe(303);
      expect(response.headers().location).toContain(
        'actionSuccess=role-updated'
      );

      await page.goto(response.headers().location);
      await expect(
        page.getByRole('alert').filter({ hasText: 'Role updated successfully' })
      ).toBeVisible();
      await expect(select).toHaveValue(nextRole);
    } finally {
      expect((await postRole(originalRole)).status()).toBe(303);
    }
  });

  test('invite posts without exposing member details in browser history', async ({
    page,
  }) => {
    await page.goto(MEMBERS);

    const form = page
      .getByRole('button', { name: 'Invite', exact: true })
      .locator('xpath=ancestor::form');
    const privateValues = {
      email: 'native-fallback@example.com',
      displayName: 'Native Fallback User',
      username: 'native-fallback-user',
    };
    await form.getByLabel('Email').fill(privateValues.email);
    await form
      .getByLabel('Display name (optional)')
      .fill(privateValues.displayName);
    await form.getByLabel('Username (optional)').fill(privateValues.username);

    const posted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === MEMBERS
    );
    await form.getByRole('button', { name: 'Invite', exact: true }).click();

    expect((await posted).status()).toBe(303);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Member invited successfully' })
    ).toBeVisible();
    for (const value of Object.values(privateValues)) {
      expect(decodeURIComponent(page.url())).not.toContain(value);
    }

    const failed = await page.request.post(MEMBERS, {
      headers: { origin: new URL(page.url()).origin },
      form: { _action: 'invite', role: 'Member', ...privateValues },
    });
    expect(failed.status()).toBe(400);
    expect(await failed.text()).toContain('Failed to invite member');
  });

  test('admin success banners only accept route-owned keys', async ({
    page,
  }) => {
    const cases = [
      [MEMBERS, 'role-updated', 'Role updated successfully'],
      [MATCHES, 'matches-recalculated', 'Matches recalculated successfully'],
      [FLAGS, 'matches-recalculated', 'Matches recalculated successfully'],
    ] as const;

    for (const [route, key, message] of cases) {
      await page.goto(`${route}?actionSuccess=${key}`);
      await expect(
        page.getByRole('alert').filter({ hasText: message })
      ).toBeVisible();

      const spoofed = 'Your account permissions were upgraded';
      await page.goto(`${route}?actionSuccess=${encodeURIComponent(spoofed)}`);
      await expect(page.getByText(spoofed, { exact: true })).toHaveCount(0);
    }
  });
});

test('native admin forms reject cross-origin posts', async ({ page }) => {
  await gotoAuthed(page, MEMBERS);
  const response = await page.request.post(MEMBERS, {
    headers: { origin: 'https://example.invalid' },
    form: {
      _action: 'invite',
      email: 'cross-origin@example.com',
      role: 'Member',
      displayName: 'Cross Origin',
      username: 'cross-origin',
    },
  });
  expect(response.status()).toBe(403);
});

test('failed server functions keep their HTTP status and form feedback', async ({
  page,
}) => {
  await gotoAuthed(page, MATCHES);
  await page.getByTestId('admin-match-edit').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type="number"]').nth(0).fill('4');
  await dialog.locator('input[type="number"]').nth(1).fill('3');

  const posted = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.startsWith('/_serverFn/')
  );
  await dialog.getByRole('button', { name: 'Save match' }).click();

  const response = await posted;
  expect(response.status()).toBeGreaterThanOrEqual(400);
  await expect(dialog.getByRole('alert')).toContainText(/exactly 10/i);

  const crossOriginResponse = await page.request.fetch(response.request(), {
    headers: {
      ...(await response.request().allHeaders()),
      origin: 'https://example.invalid',
      'sec-fetch-site': 'cross-site',
    },
  });
  expect(crossOriginResponse.status()).toBe(403);
});

test('admin RPC transport failures are visible', async ({ page }) => {
  await gotoAuthed(page, MATCHES);
  await page.getByTestId('admin-match-edit').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type="number"]').nth(0).fill('10');
  await dialog.locator('input[type="number"]').nth(1).fill('5');

  await page.route(
    (url) => url.pathname.startsWith('/_serverFn/'),
    async (route) => {
      if (route.request().method() === 'POST') await route.abort();
      else await route.fallback();
    }
  );
  await dialog.getByRole('button', { name: 'Save match' }).click();

  await expect(dialog.getByRole('alert')).toHaveText(
    'Request failed. Please try again.'
  );
});
