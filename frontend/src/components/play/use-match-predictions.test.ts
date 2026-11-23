import { describe, expect, it } from 'vitest';
import {
  MAX_PREDICTED_MATCHES,
  MISSING_RETRIES,
  answerPredictions,
  matchPredictionsUrl,
  missingRetryMs,
  nextMissingStreak,
  predictionIds,
} from './use-match-predictions';

describe('predictionIds', () => {
  it('drops missing ids and repeats, and sorts the rest', () => {
    expect(predictionIds(['b', undefined, 'a', null, '', 'b'])).toEqual([
      'a',
      'b',
    ]);
  });

  it('keeps the first ids up to what the API answers, wherever they sort', () => {
    // The found match comes first; its id may sort last.
    const ids = Array.from(
      { length: MAX_PREDICTED_MATCHES + 5 },
      (_, i) => `m${String(i).padStart(2, '0')}`
    ).reverse();
    const picked = predictionIds(ids);
    expect(picked).toHaveLength(MAX_PREDICTED_MATCHES);
    expect(picked).toContain('m24');
    expect(picked).not.toContain('m00');
  });
});

describe('matchPredictionsUrl', () => {
  it('repeats pendingMatchId once per match', () => {
    expect(matchPredictionsUrl('org', 'league', ['a', 'b'])).toBe(
      '/api/v3/organizations/org/leagues/league/match-predictions?pendingMatchId=a&pendingMatchId=b'
    );
  });
});

describe('retrying a missing match', () => {
  it('counts answers in a row that leave a match out', () => {
    expect(nextMissingStreak(undefined, 0, 1)).toBe(1);
    expect(nextMissingStreak(3, 1, 2)).toBe(4);
    // A complete answer starts the count again, however many came before.
    expect(nextMissingStreak(3, 2, 2)).toBe(0);
  });

  it('asks again after an outage that starts late, up to the budget', () => {
    let streak = 0;
    // Many complete answers first, as on a long live match.
    for (let i = 0; i < 10; i++) streak = nextMissingStreak(streak, 1, 1);
    expect(missingRetryMs(streak)).toBe(false);

    const delays = [];
    for (let i = 0; i < MISSING_RETRIES + 2; i++) {
      streak = nextMissingStreak(streak, 0, 1);
      delays.push(missingRetryMs(streak));
    }
    expect(delays.filter((d) => d !== false)).toHaveLength(MISSING_RETRIES);
    expect(delays.at(-1)).toBe(false);
  });
});

describe('answerPredictions', () => {
  const odds = { pendingMatchId: 'a', teams: [] };

  it('builds on the stored answer', async () => {
    const answer = await answerPredictions(
      async () => [],
      () => ({ predictions: [], missingStreak: 2 }),
      1
    );
    expect(answer).toEqual({ predictions: [], missingStreak: 3 });
  });

  it('counts a failed request as missing and keeps the last odds', async () => {
    const answer = await answerPredictions(
      () => Promise.reject(new Error('502')),
      () => ({ predictions: [odds], missingStreak: 0 }),
      1
    );
    expect(answer).toEqual({ predictions: [odds], missingStreak: 1 });
    expect(missingRetryMs(answer.missingStreak)).not.toBe(false);
  });

  it('retries a set whose first request fails', async () => {
    const answer = await answerPredictions(
      () => Promise.reject(new Error('502')),
      () => undefined,
      1
    );
    expect(answer).toEqual({ predictions: [], missingStreak: 1 });
  });
});
