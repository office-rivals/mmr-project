// ---------------------------------------------------------------------------
// REGRESSION SPEC FOR CLAIMING A NAME-ONLY PLAYER AFTER INVITE ONBOARDING.
//
// The bug:
//   1. A signed-in member submits a match and adds a teammate through the
//      "Add new player" dialog with only a display name (no email).
//      V3MatchesService.ResolveNewPlayerAsync then writes an
//      organization_memberships row with user_id = NULL, invite_email = NULL,
//      status = Active, plus a league_players row for it.
//   2. Later the real human signs up via Clerk and joins the org with an invite
//      code (InviteLinkService.JoinOrganizationAsync). That claim logic only
//      reuses memberships matched by UserId, by InviteEmail + Invited status, or
//      by Removed status. A name-only placeholder matches none of them, so a
//      fresh membership is created for the human. The claim flow must transfer
//      the identity to the placeholder and retire that fresh membership.
//
// This spec mutates the seed (submits a match, creates an invite link, adds an
// org member and a league player), so it is deliberately named to sort last:
// the suite runs serially (workers: 1) and global.setup re-seeds every run.
// ---------------------------------------------------------------------------
import { execFileSync } from 'node:child_process';
import { test, expect, type Page } from '@playwright/test';

// Fixture ids from scripts/seed-data.sql.
const ORG_ID = '11111111-1111-1111-1111-111111111111';
const LEAGUE_ID = '22222222-2222-2222-2222-222222222222';
const OWNER_MEMBERSHIP_ID = '55555555-5555-5555-5555-555555555501';

// Invite codes are uppercase, 6-12 chars from A-Z minus I/L/O plus 2-9.
const INVITE_CODE = 'E2EDUPEXYZ9';
// The name-only placeholder created through the match-submit dialog.
const GUEST_NAME = 'Zed Guest';

const SUBMIT_URL = '/test-org/test-league/submit';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

// The second human: a throwaway Clerk identity. The "+clerk_test" suffix makes
// Clerk treat the address as a test identity (no captcha / bot protection).
const user2Email = `e2e-dupe-${Date.now()}+clerk_test@example.com`;
const user2Password = 'E2eDupe!Xy7Qz2026';
const user3Email = `e2e-skip-${Date.now()}+clerk_test@example.com`;
const user3Password = 'E2eSkip!Xy7Qz2026';

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
      encoding: 'utf8',
    }
  ).trim();
}

async function clerkApi(path: string, init: RequestInit = {}) {
  return fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/** Fills the next empty player slot inside a team step. */
async function pickPlayer(
  page: Page,
  team: ReturnType<Page['locator']>,
  filter: string
) {
  const input = team.locator('input[placeholder="Filter..."]').first();
  await input.fill(filter);
  await page
    .locator('button', { hasText: new RegExp(filter, 'i') })
    .first()
    .click();
}

async function signInAndJoinOrganization(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/login');
  await page.locator('input[name=identifier]').fill(email);
  await page.locator('input[name=identifier]').press('Enter');
  await page.locator('input[name=password]').fill(password);
  await page.locator('input[name=password]').press('Enter');
  await expect(
    page.getByText(/not a member of any organizations/i)
  ).toBeVisible({ timeout: 20_000 });

  await page.goto('/join', { waitUntil: 'networkidle' });
  const codeInput = page.locator('#invite-code');
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await expect(async () => {
    await codeInput.fill('');
    await codeInput.fill(INVITE_CODE);
    await expect(continueButton).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await continueButton.click();
  await expect(page).toHaveURL(new RegExp(`/join/${INVITE_CODE}$`));
  await expect(page.getByText("You've been invited!")).toBeVisible();
  await page.getByRole('button', { name: 'Join Organization' }).click();
  await expect(page).toHaveURL(/\/test-org$/, { timeout: 20_000 });
}

test.describe.serial('Invite onboarding claims a name-only player', () => {
  let clerkUserId = '';
  let skippingClerkUserId = '';

  test.beforeAll(async () => {
    expect(
      CLERK_SECRET_KEY,
      'CLERK_SECRET_KEY must be set (loaded from frontend/.env by playwright.config.ts)'
    ).toBeTruthy();

    // Arrange: a deterministic invite link for Test Org. No invite links are
    // seeded, and the seed truncates this table on every run.
    psql(
      `DELETE FROM organization_invite_links WHERE code = '${INVITE_CODE}';
       INSERT INTO organization_invite_links
         (id, organization_id, code, created_by_membership_id, use_count, created_at)
       VALUES (gen_random_uuid(), '${ORG_ID}', '${INVITE_CODE}',
               '${OWNER_MEMBERSHIP_ID}', 0, now());`
    );

    const res = await clerkApi('/users', {
      method: 'POST',
      body: JSON.stringify({
        email_address: [user2Email],
        password: user2Password,
      }),
    });
    const body = await res.json();
    expect(
      res.ok,
      `Clerk user creation failed: ${res.status} ${JSON.stringify(body)}`
    ).toBeTruthy();
    clerkUserId = body.id;

    const skipRes = await clerkApi('/users', {
      method: 'POST',
      body: JSON.stringify({
        email_address: [user3Email],
        password: user3Password,
      }),
    });
    const skipBody = await skipRes.json();
    expect(
      skipRes.ok,
      `Clerk user creation failed: ${skipRes.status} ${JSON.stringify(skipBody)}`
    ).toBeTruthy();
    skippingClerkUserId = skipBody.id;
  });

  test.afterAll(async () => {
    for (const userId of [clerkUserId, skippingClerkUserId]) {
      if (!userId) continue;
      try {
        await clerkApi(`/users/${userId}`, { method: 'DELETE' });
      } catch {
        // Best effort — a leftover throwaway Clerk user doesn't affect the suite.
      }
    }
  });

  test('owner submits a match with a name-only guest teammate', async ({
    page,
  }) => {
    await page.goto(SUBMIT_URL);
    // The "You" slot auto-fills from localStorage; start from a clean slate.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const team1 = page.locator('#team1-step');
    const team2 = page.locator('#team2-step');

    await pickPlayer(page, team1, 'tuser');

    // No seeded player matches the guest's name, so the picker offers to
    // create one.
    await team1.locator('input[placeholder="Filter..."]').first().fill('Zed G');
    const addNewPlayer = page.getByRole('button', { name: 'Add new player' });
    await expect(addNewPlayer).toBeVisible();
    await addNewPlayer.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Display name').fill(GUEST_NAME);
    // Username and email are deliberately left empty — an email is what would
    // let the placeholder be claimed later.
    await expect(dialog.getByLabel('Email (optional)')).toHaveValue('');
    await dialog.getByRole('button', { name: 'Use player' }).click();
    await expect(dialog).toBeHidden();
    await expect(team1.getByText(GUEST_NAME)).toBeVisible();

    await pickPlayer(page, team2, 'alia');
    await pickPlayer(page, team2, 'bobr');

    await expect(page.getByRole('heading', { name: 'Who won?' })).toBeVisible();
    await page.getByRole('button', { name: /We won/ }).click();

    await expect(
      page.getByRole('heading', { name: /What was their score\?/ })
    ).toBeVisible();
    await page
      .locator('#score-step')
      .getByRole('button', { name: '5', exact: true })
      .click();

    await expect(page.getByRole('heading', { name: 'Submit?' })).toBeVisible();
    await page.getByRole('button', { name: 'Submit the match' }).click();

    // A successful submit redirects to the league leaderboard.
    await expect(
      page.getByRole('heading', { level: 1, name: 'Leaderboard' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Recent Matches' })
    ).toBeVisible();
  });

  test('the guest is stored as one unclaimed, name-only membership', async () => {
    expect(
      psql(
        `SELECT count(*) FROM organization_memberships
         WHERE organization_id = '${ORG_ID}' AND display_name = '${GUEST_NAME}';`
      )
    ).toBe('1');

    // user_id NULL + invite_email NULL + status 1 (Active) is exactly the shape
    // that the invite-claim logic can't match on.
    expect(
      psql(
        `SELECT count(*) FROM organization_memberships
         WHERE organization_id = '${ORG_ID}' AND display_name = '${GUEST_NAME}'
           AND user_id IS NULL AND invite_email IS NULL AND status = 1;`
      )
    ).toBe('1');

    expect(
      psql(
        `SELECT count(*) FROM league_players lp
         JOIN organization_memberships m ON m.id = lp.organization_membership_id
         WHERE lp.league_id = '${LEAGUE_ID}' AND m.display_name = '${GUEST_NAME}';`
      )
    ).toBe('1');
  });

  test('the real human joins and requests the existing guest player', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    try {
      await signInAndJoinOrganization(page, user2Email, user2Password);

      const joinLeague = page
        .locator('form[action="?/joinLeague"]')
        .filter({
          has: page.locator('input[name="leagueSlug"][value="test-league"]'),
        })
        .getByRole('button', { name: 'Join League' });
      await expect(joinLeague).toBeVisible();
      await page.getByRole('link', { name: 'Claim your player' }).click();
      await expect(page).toHaveURL(/\/test-org\/claim$/);
      await expect(page.getByText(GUEST_NAME)).toBeVisible();
      await page
        .locator('label')
        .filter({ hasText: GUEST_NAME })
        .getByRole('radio')
        .check();
      await page.getByTestId('claim-submit').click();
      await expect(page.getByTestId('claim-pending')).toBeVisible();

      await page.goto('/test-org');
      await expect(page.getByText(/claim awaiting approval/i)).toBeVisible();
      await expect(joinLeague).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('a second invitee can skip claiming and see the banner again', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    try {
      await signInAndJoinOrganization(page, user3Email, user3Password);
      await page.getByRole('link', { name: 'Claim your player' }).click();
      await expect(page.getByText(GUEST_NAME)).toBeVisible();
      await page.getByTestId('claim-skip').click();
      await expect(page).toHaveURL(/\/test-org$/);
      await expect(
        page.getByRole('link', { name: 'Claim your player' })
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('the owner approves the pending claim', async ({ page }) => {
    await page.goto('/admin/test-org/members');
    await expect(page.getByText(user2Email).first()).toBeVisible();
    await expect(page.getByText(GUEST_NAME).first()).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId(/^claim-approve-/).click();
    await expect(page.getByText('Claim request approved')).toBeVisible();
  });

  test('the identity moves to the placeholder and its original history survives', async () => {
    expect(
      psql(
        `SELECT count(*) FROM organization_memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.organization_id = '${ORG_ID}'
           AND u.identity_user_id = '${clerkUserId}';`
      )
    ).toBe('1');

    expect(
      psql(
        `SELECT count(*) FROM organization_memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.organization_id = '${ORG_ID}'
           AND m.display_name = '${GUEST_NAME}'
           AND u.identity_user_id = '${clerkUserId}' AND m.status = 1;`
      )
    ).toBe('1');

    expect(
      psql(
        `SELECT count(*) FROM membership_claim_requests c
         JOIN organization_memberships retired ON retired.id = c.retired_membership_id
         JOIN users u ON u.id = c.user_id
         WHERE c.organization_id = '${ORG_ID}' AND c.status = 1
           AND u.identity_user_id = '${clerkUserId}'
           AND retired.user_id IS NULL AND retired.status = 2;`
      )
    ).toBe('1');

    expect(
      psql(
        `SELECT count(*) FROM league_players lp
         JOIN membership_claim_requests c
           ON lp.organization_membership_id IN
             (c.organization_membership_id, c.retired_membership_id)
         JOIN users u ON u.id = c.user_id
         WHERE lp.league_id = '${LEAGUE_ID}' AND c.status = 1
           AND u.identity_user_id = '${clerkUserId}';`
      )
    ).toBe('1');

    expect(
      psql(
        `SELECT count(*) FROM rating_histories rh
         JOIN league_players lp ON lp.id = rh.league_player_id
         JOIN organization_memberships m ON m.id = lp.organization_membership_id
         JOIN users u ON u.id = m.user_id
         WHERE lp.league_id = '${LEAGUE_ID}'
           AND u.identity_user_id = '${clerkUserId}';`
      )
    ).not.toBe('0');
  });

  test('the admin members list shows one linked row for the human', async ({
    page,
  }) => {
    await page.goto('/admin/test-org/members');
    await expect(
      page.getByRole('heading', { name: 'Members', level: 1 })
    ).toBeVisible();

    await expect(page.getByText(GUEST_NAME)).toHaveCount(1);
    await expect(page.getByText(user2Email).first()).toBeVisible();
  });
});
