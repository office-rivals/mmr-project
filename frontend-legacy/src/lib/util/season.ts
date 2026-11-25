/**
 * Selects the current season: the season with the latest `startsAt` at or before
 * `now`.
 *
 * Order-independent — it does not assume the input is sorted — and ignores
 * entries whose `startsAt` cannot be parsed.
 */
export function selectCurrentSeason<T extends { startsAt: string }>(
  seasons: readonly T[],
  now: number = Date.now()
): T | null {
  let current: T | null = null;
  let currentStartsAt = -Infinity;

  for (const season of seasons) {
    const startsAtMs = Date.parse(season.startsAt);
    if (Number.isNaN(startsAtMs)) continue;
    if (startsAtMs > now) continue;
    if (startsAtMs <= currentStartsAt) continue;

    current = season;
    currentStartsAt = startsAtMs;
  }

  return current;
}
