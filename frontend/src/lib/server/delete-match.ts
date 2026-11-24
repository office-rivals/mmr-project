import { confirmsMatchScore, matchScoreLabel } from '@/lib/match-review';
import { failServerAction } from '@/lib/server/action-result';
import { resolveOrgAndLeagueIds } from '@/lib/server/admin';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { getApiErrorDetails } from '@/lib/server/apiError';

export interface AdminMatchActionResult {
  success: boolean;
  message: string;
}

export interface DeleteMatchInput {
  orgSlug: string;
  leagueSlug: string;
  matchId: string;
  /** The match's score as the admin typed it, e.g. "10-5". */
  confirmation: string;
}

/**
 * Deletes a match only when the typed score matches the stored one, so the
 * admin has looked at the match they are deleting. Typing is a deliberate
 * step, not a lock: the API deletes whatever the match is by then.
 */
export async function deleteMatch(
  data: DeleteMatchInput
): Promise<AdminMatchActionResult> {
  if (!data.matchId)
    return failServerAction(400, {
      success: false,
      message: 'matchId required',
    });

  const apiClientV3 = await requireApiClientV3();
  const ctx = await resolveOrgAndLeagueIds(apiClientV3, data);
  if (!ctx)
    return failServerAction(404, {
      success: false,
      message: 'Org or league not found',
    });

  try {
    const match = await apiClientV3.matchesApi.getMatch(
      ctx.orgId,
      ctx.leagueId,
      data.matchId
    );
    if (!confirmsMatchScore(data.confirmation ?? '', match)) {
      return failServerAction(400, {
        success: false,
        message: `Type the score ${matchScoreLabel(match)} to delete this match.`,
      });
    }
    await apiClientV3.matchesApi.deleteMatch(
      ctx.orgId,
      ctx.leagueId,
      data.matchId
    );
    return {
      success: true,
      message:
        'Match deleted. Run Recalculate season so every rating is right.',
    };
  } catch (err) {
    const { status, message } = await getApiErrorDetails(
      err,
      'Failed to delete match'
    );
    return failServerAction(status, { success: false, message });
  }
}
