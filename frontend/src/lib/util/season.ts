/**
 * Selects the current season from a list ordered by `startsAt` descending.
 *
 * `listSeasons()` returns every season newest-first, so a not-yet-started
 * season sorts to index 0. The current season is the most recent one whose
 * `startsAt` is at or before `now`.
 */
export function selectCurrentSeason<T extends { startsAt: string }>(
  seasons: readonly T[],
  now: number = Date.now()
): T | null {
  return seasons.find((s) => new Date(s.startsAt).getTime() <= now) ?? null;
}
