import playwright, {
  type Page,
} from '../../frontend/node_modules/@playwright/test/index.js';
import { execFileSync } from 'node:child_process';
import { gotoAuthed } from './helpers';

const { expect, test } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');

const ORG = '/test-org';
const CLAIM = '/test-org/claim';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
// The signed-in test user, who owns Test Org (scripts/seed-data.sql).
const TEST_USER_ID = '44444444-4444-4444-4444-444444444401';
const PLACEHOLDER_ID = 'eeeeeeee-2000-0000-0000-000000000001';
const CLAIM_ID = 'eeeeeeee-2000-0000-0000-000000000002';
const LEAGUE_ID = 'eeeeeeee-2000-0000-0000-000000000003';
const PLACEHOLDER_NAME = 'Claim Fixture';
const LEAGUE_NAME = 'Claim Fixture League';

const ClaimStatus = { Pending: 0, Approved: 1, Rejected: 2 } as const;

function psql(sql: string) {
  execFileSync(
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
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      env: {
        ...process.env,
        PGPASSWORD: process.env.E2E_DB_PASS ?? 'this_is_a_hard_password1337',
      },
      input: sql,
    }
  );
}

const removeFixtures = () =>
  psql(`
    DELETE FROM membership_claim_requests
    WHERE organization_membership_id = '${PLACEHOLDER_ID}';
    DELETE FROM leagues WHERE id = '${LEAGUE_ID}';
    DELETE FROM organization_memberships WHERE id = '${PLACEHOLDER_ID}';
  `);

// The test user has match history, so the API would refuse a real claim; the
// rows are written directly to reach each state.
function arrangeClaim(status: number, reviewNote?: string) {
  psql(`
    DELETE FROM membership_claim_requests
    WHERE organization_membership_id = '${PLACEHOLDER_ID}';
    INSERT INTO membership_claim_requests
      (id, organization_id, organization_membership_id, user_id, status, note,
       review_note, created_at)
    VALUES ('${CLAIM_ID}', '${ORG_ID}', '${PLACEHOLDER_ID}', '${TEST_USER_ID}',
            ${status}, 'I used to play here',
            ${reviewNote ? `'${reviewNote}'` : 'NULL'}, now());
  `);
}

const leagueRow = (page: Page) =>
  page.getByRole('listitem').filter({ hasText: LEAGUE_NAME });

test.beforeAll(() => {
  removeFixtures();
  psql(`
    INSERT INTO organization_memberships
      (id, organization_id, role, status, display_name, created_at)
    VALUES ('${PLACEHOLDER_ID}', '${ORG_ID}', 2, 1, '${PLACEHOLDER_NAME}', now());
    INSERT INTO leagues
      (id, organization_id, name, slug, team_size, winning_score, created_at)
    VALUES ('${LEAGUE_ID}', '${ORG_ID}', '${LEAGUE_NAME}',
            'claim-fixture-league', 1, 10, now());
  `);
});

test.afterAll(removeFixtures);

test('a pending claim replaces joining with a link to the claim', async ({
  page,
}) => {
  arrangeClaim(ClaimStatus.Pending);

  await gotoAuthed(page, ORG);
  await expect(leagueRow(page)).toContainText(
    'Join once your claim is decided'
  );
  await expect(
    leagueRow(page).getByRole('button', { name: 'Join League' })
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Claim your player' })
  ).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Player claim awaiting approval' })
    .click();

  await expect(page).toHaveURL(CLAIM);
  const pending = page.getByTestId('claim-pending');
  await expect(pending).toContainText(PLACEHOLDER_NAME);
  await expect(pending).toContainText('Pending');
  await expect(pending).toContainText('“I used to play here”');
  await expect(pending).toContainText(
    "Don't play matches until this is decided."
  );
  await expect(page.getByText('Step 2 of 3', { exact: false })).toBeAttached();
});

test('a rejection reaches the member with its reason', async ({ page }) => {
  arrangeClaim(ClaimStatus.Rejected, 'Not the same person');

  const turnedDown = `A moderator turned down your claim request for ${PLACEHOLDER_NAME}.`;
  await gotoAuthed(page, CLAIM);
  await expect(page.getByText(turnedDown)).toBeVisible();
  await expect(page.getByText('“Not the same person”')).toBeVisible();
  // The test user has match history, so there is nothing left to claim.
  await expect(
    page.getByText("There's no player to claim right now.", { exact: false })
  ).toBeVisible();

  // Nothing left to claim, so the org page points back to the reason instead.
  await gotoAuthed(page, ORG);
  await expect(page.getByText(turnedDown)).toBeVisible();
  await expect(page.getByRole('link', { name: 'See why' })).toHaveAttribute(
    'href',
    CLAIM
  );
  await expect(
    leagueRow(page).getByRole('button', { name: 'Join League' })
  ).toBeVisible();
});

test('an approved claim confirms the transfer', async ({ page }) => {
  arrangeClaim(ClaimStatus.Approved);

  await gotoAuthed(page, CLAIM);
  await expect(
    page.getByText(`You're linked to ${PLACEHOLDER_NAME}.`)
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Back to organization' })
  ).toHaveAttribute('href', ORG);
});

test('cancelling a claim decided meanwhile shows why it failed', async ({
  page,
}) => {
  arrangeClaim(ClaimStatus.Pending);
  await gotoAuthed(page, CLAIM);
  const cancel = page.getByTestId('claim-cancel');
  await expect(cancel).toBeEnabled();

  // A moderator decides the claim while this page is open.
  arrangeClaim(ClaimStatus.Rejected);
  await cancel.click();
  const alert = page
    .getByRole('alert')
    .filter({ hasText: 'A moderator already turned down this claim request.' });
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  // The page reloads the claim, so the stale pending card goes away.
  await expect(page.getByTestId('claim-pending')).toHaveCount(0);
});

test.describe('native claim forms', () => {
  test.use({ javaScriptEnabled: false });

  test('cancelling posts natively and redirects with feedback', async ({
    page,
  }) => {
    arrangeClaim(ClaimStatus.Pending);
    await page.goto(CLAIM);

    const posted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === CLAIM
    );
    await page.getByTestId('claim-cancel').click();

    expect((await posted).status()).toBe(303);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Claim request cancelled' })
    ).toBeVisible();
    await expect(page.getByTestId('claim-pending')).toHaveCount(0);
  });

  test('a refused claim keeps its status and reason', async ({ page }) => {
    psql(`
      DELETE FROM membership_claim_requests
      WHERE organization_membership_id = '${PLACEHOLDER_ID}';
    `);
    await page.goto(CLAIM);

    const response = await page.request.post(CLAIM, {
      headers: { origin: new URL(page.url()).origin },
      form: { _action: 'submit', membershipId: PLACEHOLDER_ID, note: '' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('already played here');
  });
});
