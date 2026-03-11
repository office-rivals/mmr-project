import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, fetch, url }) => {
  const { orgId, leagueId } = await parent();
  const base = `/api/v3/organizations/${orgId}/leagues/${leagueId}`;

  const seasonId = url.searchParams.get('season') ?? undefined;
  const seasonQuery = seasonId ? `?seasonId=${seasonId}` : '';

  try {
    const [leaderboard, seasons] = await Promise.all([
      fetch(`${base}/leaderboard${seasonQuery}`).then((r) => r.json()),
      fetch(`${base}/seasons`).then((r) => r.json()),
    ]);

    const playerHistories = await Promise.all(
      (leaderboard?.entries ?? []).slice(0, 10).map(
        async (entry: { leaguePlayerId: string; displayName?: string; username?: string }) => {
          const historyResponse = await fetch(
            `${base}/rating-history/${entry.leaguePlayerId}${seasonQuery}`
          );
          if (!historyResponse.ok) return null;
          const history = await historyResponse.json();
          return {
            name: entry.displayName ?? entry.username ?? 'Unknown',
            entries: history.entries ?? [],
          };
        }
      )
    );

    const statistics = playerHistories
      .filter(Boolean)
      .flatMap(
        (ph: { name: string; entries: { recordedAt: string; mmr: number }[] } | null) =>
          ph?.entries.map((e: { recordedAt: string; mmr: number }) => ({
            name: ph.name,
            date: e.recordedAt,
            mmr: e.mmr,
          })) ?? []
      );

    return {
      statistics,
      seasons: seasons ?? [],
      currentSeason: seasons?.[0] ?? null,
    };
  } catch {
    return fail(500, { message: 'Failed to load statistics' });
  }
};
