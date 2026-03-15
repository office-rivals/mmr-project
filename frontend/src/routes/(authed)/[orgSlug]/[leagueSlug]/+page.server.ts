import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { matchFlagActions } from '$lib/server/actions/matchFlagActions';

export const load: PageServerLoad = async ({ parent, fetch, url }) => {
  const { orgId, leagueId } = await parent();
  const base = `/api/v3/organizations/${orgId}/leagues/${leagueId}`;

  const seasonId = url.searchParams.get('season') ?? undefined;
  const seasonQuery = seasonId ? `?seasonId=${seasonId}` : '';

  const [leaderboardRes, matchesRes, seasonsRes, playersRes, queueRes, myFlagsRes] =
    await Promise.all([
      fetch(`${base}/leaderboard${seasonQuery}`),
      fetch(`${base}/matches?limit=5&offset=0`),
      fetch(`${base}/seasons`),
      fetch(`${base}/players`),
      fetch(`${base}/queue`).catch(() => null),
      fetch(`${base}/match-flags/me`).catch(() => null),
    ]);

  if (!leaderboardRes.ok) {
    throw error(500, 'Failed to load leaderboard');
  }

  const leaderboard = await leaderboardRes.json();
  const matches = matchesRes.ok ? await matchesRes.json() : [];
  const seasons = seasonsRes.ok ? await seasonsRes.json() : [];
  const players = playersRes.ok ? await playersRes.json() : [];
  const queueStatus = queueRes?.ok ? await queueRes.json() : null;
  const myFlags = myFlagsRes?.ok ? await myFlagsRes.json() : [];

  return {
    leaderboard,
    recentMatches: matches,
    seasons,
    currentSeason: seasons[0] ?? null,
    players,
    queueStatus,
    myFlags,
  };
};

export const actions: Actions = {
  ...matchFlagActions,
};
