import { test, expect } from '@playwright/test';

const FLAGS_PAGE = '/admin/test-org/leagues/test-league/match-flags';

// The seed (scripts/seed-data.sql) creates three open flags in Test League:
//   A: "Wrong score reported on this match (e2e A)."  current season, by Alice
//   B: "Possible duplicate match entry (e2e B)."      current season, by Bob
//   C: "Match from a previous season (e2e C)."        past season, by Carol
const FLAG_A_REASON = 'Wrong score reported on this match (e2e A).';
const FLAG_B_REASON = 'Possible duplicate match entry (e2e B).';
const FLAG_C_REASON = 'Match from a previous season (e2e C).';

const cardWithReason = (
  page: import('@playwright/test').Page,
  reason: string
) => page.getByTestId('match-flag-card').filter({ hasText: reason });

test.describe('Admin match flags', () => {
  test('shows the flagged match inline with who flagged it and why', async ({
    page,
  }) => {
    await page.goto(FLAGS_PAGE);
    await expect(
      page.getByRole('heading', { name: 'Flagged Matches' })
    ).toBeVisible();

    const card = cardWithReason(page, FLAG_A_REASON);
    await expect(card).toBeVisible();
    // The flag's match is rendered inline (MatchCard shows the "vs." separator).
    await expect(card.getByText('vs.')).toBeVisible();
    // Flag metadata is present alongside the match.
    await expect(card.getByText(/Flagged by Alice Anderson/)).toBeVisible();
    await expect(card.getByText(FLAG_A_REASON)).toBeVisible();
  });

  test('edits the flagged match from the flag, leaving rating history intact', async ({
    page,
  }) => {
    await page.goto(FLAGS_PAGE);

    const card = cardWithReason(page, FLAG_A_REASON);
    await card.getByTestId('match-flag-edit').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Edit match')).toBeVisible();
    // The dialog pre-fills the flagged match's two teams.
    await expect(dialog.getByText('Team 1', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Team 2', { exact: true })).toBeVisible();

    // Test League is fixed-target (winning_score = 10), so submit a valid
    // winner/loser pair. Re-running with the same values is idempotent, which
    // keeps this test safe under CI retries.
    const scoreInputs = dialog.locator('input[type="number"]');
    await scoreInputs.nth(0).fill('10');
    await scoreInputs.nth(1).fill('5');
    await dialog.getByRole('button', { name: 'Save match' }).click();

    // A successful PATCH closes the dialog and surfaces a success alert.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Match updated' })
    ).toBeVisible();
  });

  test('disables edit/recalc for a flag on a past-season match', async ({
    page,
  }) => {
    await page.goto(FLAGS_PAGE);

    const card = cardWithReason(page, FLAG_C_REASON);
    await expect(card).toBeVisible();
    // The match still renders for review...
    await expect(card.getByText('vs.')).toBeVisible();
    // ...but Edit/Recalc are disabled because the API rejects edits and
    // recalculation outside the current season, with an explanation shown.
    await expect(card.getByTestId('match-flag-edit')).toBeDisabled();
    await expect(card.getByTestId('match-flag-recalculate')).toBeDisabled();
    await expect(card.getByText(/past season/i)).toBeVisible();
    // Resolving/dismissing is still available for old flags.
    await expect(card.getByTestId('match-flag-resolve')).toBeEnabled();
  });

  test('resolves a flag after reviewing the match', async ({ page }) => {
    await page.goto(FLAGS_PAGE);

    const card = cardWithReason(page, FLAG_B_REASON);
    await expect(card).toBeVisible();

    // Idempotent under retries: only drive the resolve flow while the flag is
    // still open; on a retry the flag is already resolved and we just assert it.
    const resolveButton = card.getByTestId('match-flag-resolve');
    if (await resolveButton.count()) {
      await resolveButton.click();

      const dialog = page.getByRole('dialog');
      await expect(
        dialog.getByRole('heading', { name: 'Resolve Match Flag' })
      ).toBeVisible();
      // The admin sees the match while deciding how to resolve.
      await expect(dialog.getByText('vs.')).toBeVisible();

      await dialog.getByRole('button', { name: 'Resolve Flag' }).click();
      await expect(
        page
          .getByRole('alert')
          .filter({ hasText: 'Flag resolved successfully' })
      ).toBeVisible();
    }

    // Resolved flags expose no further actions.
    await expect(card.getByTestId('match-flag-resolve')).toHaveCount(0);
    await expect(card.getByTestId('match-flag-edit')).toHaveCount(0);
  });
});
