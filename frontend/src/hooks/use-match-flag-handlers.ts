import { useCallback, useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import {
  createMatchFlagFn,
  deleteMatchFlagFn,
  updateMatchFlagFn,
  type FlagActionResult,
} from '@/lib/match-flag-actions';

/**
 * Flag handlers for `ReportMatchModal`. On success the page banner is set and
 * every loader re-runs, so the feed and the user's flags are fresh by the time
 * the dialog closes. A failure never touches the banner; it stays in the dialog.
 */
export function useMatchFlagHandlers(orgId: string, leagueId: string) {
  const router = useRouter();
  const [result, setResult] = useState<FlagActionResult | null>(null);

  const after = useCallback(
    async (next: FlagActionResult): Promise<FlagActionResult> => {
      if (next.success) {
        setResult(next);
        await router.invalidate({ sync: true });
      }
      return next;
    },
    [router]
  );

  const onCreateFlag = useCallback(
    (input: { matchId: string; reason: string }) =>
      createMatchFlagFn({ data: { orgId, leagueId, ...input } }).then(after),
    [orgId, leagueId, after]
  );
  const onUpdateFlag = useCallback(
    (input: { flagId: string; reason: string }) =>
      updateMatchFlagFn({ data: { orgId, leagueId, ...input } }).then(after),
    [orgId, leagueId, after]
  );
  const onDeleteFlag = useCallback(
    (input: { flagId: string }) =>
      deleteMatchFlagFn({ data: { orgId, leagueId, ...input } }).then(after),
    [orgId, leagueId, after]
  );

  return { result, setResult, onCreateFlag, onUpdateFlag, onDeleteFlag };
}
