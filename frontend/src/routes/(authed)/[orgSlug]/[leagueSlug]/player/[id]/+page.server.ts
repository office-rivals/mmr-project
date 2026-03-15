import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { matchFlagActions } from '$lib/server/actions/matchFlagActions';

export const load: PageServerLoad = async ({ params, parent, fetch, url }) => {
  const { orgId, leagueId, leaguePlayerId, orgSlug, leagueSlug } =
    await parent();
  const base = `/api/v3/organizations/${orgId}/leagues/${leagueId}`;
  const playerId = params.id;

  const seasonId = url.searchParams.get('season') ?? undefined;
  const seasonQuery = seasonId ? `?seasonId=${seasonId}` : '';

  const [playerRes, matchesRes, historyRes, leaderboardRes, seasonsRes, myFlagsRes] =
    await Promise.all([
      fetch(`${base}/players/${playerId}`),
      fetch(`${base}/matches?leaguePlayerId=${playerId}&limit=1000&offset=0`),
      fetch(`${base}/rating-history/${playerId}${seasonQuery}`),
      fetch(`${base}/leaderboard${seasonQuery}`),
      fetch(`${base}/seasons`),
      fetch(`${base}/match-flags/me`).catch(() => null),
    ]);

  if (!playerRes.ok) {
    throw error(404, 'Player not found');
  }

  const player = await playerRes.json();
  const matches = matchesRes.ok ? await matchesRes.json() : [];
  const ratingHistory = historyRes.ok ? await historyRes.json() : { entries: [] };
  const leaderboard = leaderboardRes.ok ? await leaderboardRes.json() : { entries: [] };
  const seasons = seasonsRes.ok ? await seasonsRes.json() : [];
  const myFlags = myFlagsRes?.ok ? await myFlagsRes.json() : [];

  const playerEntry = leaderboard.entries?.find(
    (e: { leaguePlayerId: string }) => e.leaguePlayerId === playerId
  );

  const totalMatches = playerEntry?.totalMatches ?? 0;
  const wins = playerEntry?.wins ?? 0;
  const losses = playerEntry?.losses ?? 0;
  const winrate = totalMatches > 0 ? wins / totalMatches : 0;
  const mmr = playerEntry?.mmr ?? null;

  return {
    player,
    matches,
    ratingHistory,
    isCurrentUser: playerId === leaguePlayerId,
    stats: {
      mmr,
      totalMatches,
      wins,
      losses,
      winrate,
    },
    orgSlug,
    leagueSlug,
    seasons,
    currentSeason: seasons[0] ?? null,
    myFlags,
  };
};

export const actions: Actions = {
  ...matchFlagActions,
};
