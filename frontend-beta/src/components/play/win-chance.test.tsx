import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActiveMatchPage } from '@/components/play/active-match-page';
import { matchOdds } from '@/lib/match-prediction';
import { WinChance } from './win-chance';
import type { ActiveMatchResponse, MatchPredictionResponse } from '@/api-v3';

const prediction: MatchPredictionResponse = {
  teams: [
    {
      index: 0,
      winChance: 0.46,
      players: [
        { leaguePlayerId: 'p1', mmr: 1640, mmrIfWin: 1655, mmrIfLose: 1630 },
        { leaguePlayerId: 'p2', mmr: 1656, mmrIfWin: 1670, mmrIfLose: 1645 },
      ],
    },
    {
      index: 1,
      winChance: 0.54,
      players: [
        { leaguePlayerId: 'me', mmr: 1700, mmrIfWin: 1711, mmrIfLose: 1687 },
        { leaguePlayerId: 'p4', mmr: 1686, mmrIfWin: 1699, mmrIfLose: 1671 },
      ],
    },
  ],
};

// The text a sighted viewer reads: the markup's text outside its tags and
// outside screen-reader-only spans.
function visibleText(markup: string) {
  let text = '';
  let hiddenDepth = 0;
  let i = 0;
  while (i < markup.length) {
    if (markup[i] !== '<') {
      if (hiddenDepth === 0) text += markup[i];
      i++;
      continue;
    }
    const end = markup.indexOf('>', i);
    const tag = markup.slice(i, end + 1);
    if (hiddenDepth > 0) {
      if (tag.startsWith('<span')) hiddenDepth++;
      else if (tag === '</span>') hiddenDepth--;
    } else if (tag === '<span class="sr-only">') {
      hiddenDepth = 1;
    }
    i = end + 1;
  }
  return text.replace(/\s+/g, ' ');
}

function activeMatch(
  prediction: MatchPredictionResponse | null
): ActiveMatchResponse {
  const player = (leaguePlayerId: string, index: number) => ({
    leaguePlayerId,
    displayName: leaguePlayerId,
    index,
  });
  return {
    id: 'active',
    pendingMatchId: 'pending',
    startedAt: '2026-10-15T12:00:00Z',
    teams: [
      { index: 0, players: [player('p1', 0), player('p2', 1)] },
      { index: 1, players: [player('me', 0), player('p4', 1)] },
    ],
    prediction,
  };
}

function renderActiveMatch(prediction: MatchPredictionResponse | null) {
  return renderToStaticMarkup(
    <ActiveMatchPage
      activeMatch={activeMatch(prediction)}
      currentLeaguePlayerId="me"
      leagueWinningScore={10}
      formMessage={null}
      submitting={false}
      onSubmit={() => {}}
      onGoToStep={() => {}}
    />
  );
}

describe('WinChance', () => {
  it('shows both chances with the viewer’s side first, and their stake', () => {
    const odds = matchOdds(prediction, 'me')!;

    const text = visibleText(
      renderToStaticMarkup(<WinChance odds={odds} teamIndex={1} />)
    );

    expect(text).toContain('54% win chance');
    expect(text).toContain('46%');
    expect(text).toContain('Win +11 · Lose −13');
    expect(text.indexOf('54%')).toBeLessThan(text.indexOf('46%'));
  });

  it('fills the bar to the first team’s chance', () => {
    const odds = matchOdds(prediction, 'me')!;

    const markup = renderToStaticMarkup(
      <WinChance odds={odds} teamIndex={1} />
    );

    expect(markup).toContain('width:54%');
  });

  it('keeps a spectator’s view neutral and without a stake', () => {
    const odds = matchOdds(prediction, 'someone-else')!;

    const text = visibleText(
      renderToStaticMarkup(
        <WinChance compact neutral odds={odds} teamIndex={0} />
      )
    );

    expect(text).toContain('46%');
    expect(text).toContain('54%');
    expect(text).not.toContain('win chance');
    expect(text).not.toContain('Win +');
  });
});

describe('ActiveMatchPage prediction', () => {
  it('shows each team’s average MMR and the viewer’s odds', () => {
    const markup = renderActiveMatch(prediction);
    const text = visibleText(markup);

    expect(markup).toContain('data-testid="win-chance"');
    expect(text).toContain('Avg 1,648');
    expect(text).toContain('Avg 1,693');
    expect(text).toContain('54% win chance · Win +11 · Lose −13');
  });

  it('hides every part of it without a prediction', () => {
    const markup = renderActiveMatch(null);

    expect(markup).not.toContain('data-testid="win-chance"');
    expect(markup).not.toContain('Avg ');
    expect(markup).not.toContain('win chance');
    // The match itself still renders.
    expect(markup).toContain('Submit match result');
  });
});
