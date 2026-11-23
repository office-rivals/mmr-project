import { useMemo } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { MatchPredictionResponse } from '@/api-v3';

/** The API answers at most this many matches per request. */
export const MAX_PREDICTED_MATCHES = 20;

/** Present ids, once each, capped and sorted so one set of matches shares one query. */
export function predictionIds(
  pendingMatchIds: readonly (string | null | undefined)[]
): string[] {
  const ids = [
    ...new Set(pendingMatchIds.filter((id) => id != null && id !== '')),
  ];
  return (ids as string[]).slice(0, MAX_PREDICTED_MATCHES).sort();
}

export function matchPredictionsUrl(
  orgId: string,
  leagueId: string,
  pendingMatchIds: readonly string[]
): string {
  const query = new URLSearchParams(
    pendingMatchIds.map((id) => ['pendingMatchId', id])
  );
  return `/api/v3/organizations/${orgId}/leagues/${leagueId}/match-predictions?${query}`;
}

async function fetchMatchPredictions(
  orgId: string,
  leagueId: string,
  pendingMatchIds: readonly string[]
): Promise<MatchPredictionResponse[]> {
  const res = await fetch(
    matchPredictionsUrl(orgId, leagueId, pendingMatchIds)
  );
  if (!res.ok) throw new Error(`Predictions request failed: ${res.status}`);
  return res.json() as Promise<MatchPredictionResponse[]>;
}

/**
 * While a match has no odds, ask again this often, this many times in a row:
 * enough to outlast an MMR API outage (the API retries after 30 s) without
 * polling for a match that can never be predicted, such as one outside a
 * season.
 */
const MISSING_RETRY_MS = 30_000;
export const MISSING_RETRIES = 4;

export interface PredictionsAnswer {
  predictions: MatchPredictionResponse[];
  /** Answers in a row that left a match out; 0 once all are in. */
  missingStreak: number;
}

/** How many answers in a row have now left a match out. */
export function nextMissingStreak(
  previous: number | undefined,
  answered: number,
  asked: number
): number {
  return answered < asked ? (previous ?? 0) + 1 : 0;
}

/**
 * One answer for the set, and how many in a row have left a match out. A
 * failed request counts as leaving them all out, keeping the last odds shown.
 */
export async function answerPredictions(
  fetchPredictions: () => Promise<MatchPredictionResponse[]>,
  previousAnswer: () => PredictionsAnswer | undefined,
  asked: number
): Promise<PredictionsAnswer> {
  let predictions: MatchPredictionResponse[] | null;
  try {
    predictions = await fetchPredictions();
  } catch {
    predictions = null;
  }
  // Read after the request, so it is the latest stored answer.
  const previous = previousAnswer();
  return {
    predictions: predictions ?? previous?.predictions ?? [],
    missingStreak: nextMissingStreak(
      previous?.missingStreak,
      predictions?.length ?? 0,
      asked
    ),
  };
}

/** When to ask again: while matches are missing, within the retry budget. */
export function missingRetryMs(missingStreak: number | undefined) {
  return missingStreak != null &&
    missingStreak > 0 &&
    missingStreak <= MISSING_RETRIES
    ? MISSING_RETRY_MS
    : false;
}

/**
 * The odds for the chosen found or live matches, by pending match id. They
 * only move when a rating does, so they are asked for once per set of matches
 * rather than with every queue poll. A match is missing while loading, or
 * when it cannot be predicted.
 */
export function useMatchPredictions(
  orgId: string,
  leagueId: string,
  pendingMatchIds: readonly (string | null | undefined)[]
): ReadonlyMap<string, MatchPredictionResponse> {
  const ids = predictionIds(pendingMatchIds);
  const queryClient = useQueryClient();
  const queryKey = ['match-predictions', orgId, leagueId, ...ids];
  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      answerPredictions(
        () => fetchMatchPredictions(orgId, leagueId, ids),
        () => queryClient.getQueryData<PredictionsAnswer>(queryKey),
        ids.length
      ),
    enabled: ids.length > 0,
    staleTime: 60_000,
    retry: false,
    // A new match joining the set keeps the others' odds on screen meanwhile.
    placeholderData: keepPreviousData,
    refetchInterval: (query) => missingRetryMs(query.state.data?.missingStreak),
  });
  return useMemo(
    () => new Map((data?.predictions ?? []).map((p) => [p.pendingMatchId, p])),
    [data]
  );
}
