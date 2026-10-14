import { getRequest } from '@tanstack/react-start/server';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { HttpError } from '@/lib/http-error';
import { movePlayerToTopLeft } from '@/lib/move-player-to-top-left';
import { selectCurrentSeason } from '@/lib/util/season';
import type {
  LeaguePlayerResponse,
  MatchFlagResponse,
  MatchResponse,
  RatingHistoryResponse,
  SeasonResponse,
} from '@/api-v3/models';

export interface OpponentEntry {
  leaguePlayerId: string;
  displayName?: string;
  username?: string;
  wins: number;
  losses: number;
  total: number;
}

export interface PlayerProfileStats {
  mmr: number | null;
  rank: number | null;
  totalMatches: number;
  wins: number;
  lost: number;
  /** 0..1 fraction — the formatters do the ×100. */
  winrate: number;
  /** Negative for past matches; null when the player has never played. */
  daysSinceLastMatch: number | null;
  winningStreak: number;
  losingStreak: number;
}

export interface PlayerProfileData {
  orgId: string;
  leagueId: string;
  player: LeaguePlayerResponse;
  /** Newest first, each rotated by `movePlayerToTopLeft`. */
  matches: MatchResponse[];
  ratingHistory: RatingHistoryResponse;
  isCurrentUser: boolean;
  stats: PlayerProfileStats;
  teammates: OpponentEntry[];
  opponents: OpponentEntry[];
  /** Whole league roster, for the match filter. */
  players: LeaguePlayerResponse[];
  orgSlug: string;
  leagueSlug: string;
  seasons: SeasonResponse[];
  currentSeason: SeasonResponse | null;
  myFlags: MatchFlagResponse[];
  /**
   * Server clock at load time. The match-history date grouping is pinned to it
   * so SSR and hydration agree on the today/yesterday boundaries, and so a
   * season switch (which re-runs the load) recomputes them.
   */
  now: number;
}

export interface PlayerProfileInput {
  orgId: string;
  leagueId: string;
  /** The *viewer's* league player id, for the "You" badge. */
  leaguePlayerId: string | null;
  playerId: string;
  orgSlug: string;
  leagueSlug: string;
  season?: string;
}

/**
 * Port of `player/[id]/+page.server.ts`.
 *
 * The whole body is one try/catch: any failure of any call (except
 * `getMyFlags`, which self-catches to `[]`) surfaces as 404 `Player not
 * found`, including a transient leaderboard or seasons failure. That is the
 * documented Svelte behaviour — do not narrow it.
 */
export async function loadPlayerProfile(
  input: PlayerProfileInput
): Promise<PlayerProfileData> {
  const { orgId, leagueId, playerId, orgSlug, leagueSlug } = input;
  const apiClientV3 = await requireApiClientV3();

  try {
    const seasonsList = await apiClientV3.seasonsApi.listSeasons(
      orgId,
      leagueId
    );
    const currentSeason = selectCurrentSeason(seasonsList);
    const seasonId = input.season ?? currentSeason?.id;

    const [
      player,
      matches,
      ratingHistory,
      leaderboard,
      seasons,
      players,
      myFlags,
    ] = await Promise.all([
      apiClientV3.leaguePlayersApi.getPlayer(orgId, leagueId, playerId),
      apiClientV3.matchesApi.getMatches(orgId, leagueId, {
        seasonId,
        leaguePlayerId: playerId,
        limit: 1000,
        offset: 0,
      }),
      apiClientV3.ratingHistoryApi.getPlayerHistory(
        orgId,
        leagueId,
        playerId,
        seasonId
      ),
      apiClientV3.leaderboardApi.getLeaderboard(orgId, leagueId, seasonId),
      Promise.resolve(seasonsList),
      apiClientV3.leaguePlayersApi.listPlayers(orgId, leagueId),
      apiClientV3.matchFlagsApi
        .getMyFlags(orgId, leagueId)
        .catch(() => [] as MatchFlagResponse[]),
    ]);

    const playerEntry = leaderboard.entries?.find(
      (entry) => entry.leaguePlayerId === playerId
    );

    // Match stats come from this (up to 1000) page of matches, while mmr/rank/
    // streaks come from the leaderboard. The two sources are NOT unified —
    // they can legitimately disagree for a very active league.
    const totalMatches = matches.length;
    const wins = matches.filter((m) =>
      m.teams.some(
        (t) =>
          t.isWinner && t.players.some((p) => p.leaguePlayerId === playerId)
      )
    ).length;
    const lost = Math.max(totalMatches - wins, 0);
    const winrate = totalMatches > 0 ? wins / totalMatches : 0;
    const mmr = playerEntry?.mmr ?? null;

    const lastMatchAt = matches[0]?.playedAt;
    const daysSinceLastMatch = lastMatchAt
      ? Math.round(
          (new Date(lastMatchAt).getTime() - Date.now()) / 1000 / 60 / 60 / 24
        )
      : null;

    const teammateAcc: Record<string, OpponentEntry> = {};
    const opponentAcc: Record<string, OpponentEntry> = {};

    for (const match of matches) {
      const myTeam = match.teams.find((t) =>
        t.players.some((p) => p.leaguePlayerId === playerId)
      );
      const otherTeam = match.teams.find((t) => t !== myTeam);
      if (!myTeam || !otherTeam) continue;
      const isWin = !!myTeam.isWinner;

      for (const teammate of myTeam.players) {
        if (teammate.leaguePlayerId === playerId) continue;
        // Names are captured from the FIRST match a person appears in; later
        // renames inside the window are ignored.
        const acc = (teammateAcc[teammate.leaguePlayerId] ??= {
          leaguePlayerId: teammate.leaguePlayerId,
          displayName: teammate.displayName,
          username: teammate.username,
          wins: 0,
          losses: 0,
          total: 0,
        });
        acc.wins += isWin ? 1 : 0;
        acc.losses += isWin ? 0 : 1;
        acc.total += 1;
      }
      for (const opp of otherTeam.players) {
        const acc = (opponentAcc[opp.leaguePlayerId] ??= {
          leaguePlayerId: opp.leaguePlayerId,
          displayName: opp.displayName,
          username: opp.username,
          wins: 0,
          losses: 0,
          total: 0,
        });
        acc.wins += isWin ? 1 : 0;
        acc.losses += isWin ? 0 : 1;
        acc.total += 1;
      }
    }

    // Sort by `total` only; ties keep insertion order (newest match first).
    const teammates = Object.values(teammateAcc)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const opponents = Object.values(opponentAcc)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const reorderedMatches = matches.map((m) =>
      movePlayerToTopLeft(m, playerId)
    );

    return {
      orgId,
      leagueId,
      player,
      matches: reorderedMatches,
      ratingHistory,
      isCurrentUser: playerId === input.leaguePlayerId,
      stats: {
        mmr,
        rank: playerEntry?.rank ?? null,
        totalMatches,
        wins,
        lost,
        winrate,
        daysSinceLastMatch,
        winningStreak: playerEntry?.winningStreak ?? 0,
        losingStreak: playerEntry?.losingStreak ?? 0,
      },
      teammates,
      opponents,
      players,
      orgSlug,
      leagueSlug,
      seasons,
      currentSeason,
      myFlags,
      // Captured inside the load, so it refreshes on every re-run (season
      // change, invalidate after a flag action) but never while the tab idles.
      now: Date.now(),
    };
  } catch {
    // `isCurrentSeason` from the Svelte loader is deliberately dropped — it was
    // returned and never read.
    throw new HttpError(404, 'Player not found');
  }
}

const perRequest = new WeakMap<
  Request,
  Map<string, Promise<PlayerProfileData>>
>();

const cacheKey = (input: PlayerProfileInput) =>
  [input.orgId, input.leagueId, input.playerId, input.season ?? ''].join('|');

/**
 * `loadPlayerProfile` memoised per HTTP request, mirroring `loadShellDataOnce`.
 *
 * A document request reaches it twice — once from the route's status-code
 * guard, once from the loader's server function — and this is a 1000-match
 * fetch, so sharing the result matters. When the two callers do not observe the
 * same `Request` instance the memo simply misses and the second one pays for
 * its own round-trip; the result is identical either way.
 */
export function loadPlayerProfileOnce(
  input: PlayerProfileInput
): Promise<PlayerProfileData> {
  let request: Request | undefined;
  try {
    request = getRequest();
  } catch {
    request = undefined;
  }
  if (!request) return loadPlayerProfile(input);

  let byKey = perRequest.get(request);
  if (!byKey) {
    byKey = new Map();
    perRequest.set(request, byKey);
  }

  const key = cacheKey(input);
  const cached = byKey.get(key);
  if (cached) return cached;

  const promise = loadPlayerProfile(input);
  byKey.set(key, promise);
  return promise;
}
