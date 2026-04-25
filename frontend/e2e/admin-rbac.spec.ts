import { test, expect } from '@playwright/test';

// The seed gives the test user two memberships:
//   - test-org    : Owner    (full admin access)
//   - other-org   : Member   (no admin access, used here)
//
// These tests verify the /admin tree closes correctly for non-admins. We don't
// need a second Clerk identity — the same logged-in user simply hits routes
// scoped to an org where they only have Member status.

const ADMIN_HOME = '/admin';
const NON_ADMIN_ORG_SLUG = 'other-org';
const NON_ADMIN_ORG_NAME = 'Other Org';
const NON_ADMIN_LEAGUE_SLUG = 'other-league';

test.describe('Admin RBAC', () => {
  test('admin landing only lists orgs where the user is Owner or Moderator', async ({
    page,
  }) => {
    await page.goto(ADMIN_HOME);

    // The owned org is shown.
    await expect(
      page.getByRole('link', { name: /Test Org/ }).first()
    ).toBeVisible();

    // Member-only orgs do NOT show up in the administerable list. The page
    // surfaces a hint paragraph when the user has Member-only orgs that are
    // hidden — match a stable substring rather than the full sentence.
    await expect(
      page.getByText(/Member in some organizations that aren't shown here/i)
    ).toBeVisible();

    // The org's link must not appear.
    await expect(
      page.getByRole('link', { name: new RegExp(NON_ADMIN_ORG_NAME) })
    ).toHaveCount(0);
  });

  test('deep-linking to a Member-only org admin page returns 403', async ({
    page,
  }) => {
    const response = await page.goto(`/admin/${NON_ADMIN_ORG_SLUG}`);
    expect(response?.status()).toBe(403);
    // SvelteKit's default error page surfaces the message verbatim.
    await expect(
      page.getByText(/Owner or Moderator role/i)
    ).toBeVisible();
  });

  test('deep-linking into Member-only org sub-pages also 403s', async ({
    page,
  }) => {
    // Members route — same guard, same outcome.
    const membersResponse = await page.goto(
      `/admin/${NON_ADMIN_ORG_SLUG}/members`
    );
    expect(membersResponse?.status()).toBe(403);

    // Leagues list — same guard.
    const leaguesResponse = await page.goto(
      `/admin/${NON_ADMIN_ORG_SLUG}/leagues`
    );
    expect(leaguesResponse?.status()).toBe(403);

    // League-scoped admin pages live behind the org guard too — they 403 even
    // before the league sub-layout's load runs.
    const leagueResponse = await page.goto(
      `/admin/${NON_ADMIN_ORG_SLUG}/leagues/${NON_ADMIN_LEAGUE_SLUG}`
    );
    expect(leagueResponse?.status()).toBe(403);

    const matchesResponse = await page.goto(
      `/admin/${NON_ADMIN_ORG_SLUG}/leagues/${NON_ADMIN_LEAGUE_SLUG}/matches`
    );
    expect(matchesResponse?.status()).toBe(403);
  });

  test('non-admin still sees the org as a regular member outside /admin', async ({
    page,
  }) => {
    // Sanity check: the user IS a member of other-org, so the public org page
    // works. This guards against accidentally over-blocking the user.
    const response = await page.goto(`/${NON_ADMIN_ORG_SLUG}`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: NON_ADMIN_ORG_NAME })
    ).toBeVisible();
  });
});
