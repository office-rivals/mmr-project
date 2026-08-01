import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MatchResponse, MatchTeamPlayerResponse } from '@/api-v3/models';
import { MmrDelta } from './mmr-delta';

export interface MatchCardProps {
  match: MatchResponse;
  showMmr?: boolean;
  /** When supplied, player names become links to this href. */
  playerHref?: (leaguePlayerId: string) => string;
  /**
   * Escape hatch for routed pages: render the player name with a typed
   * TanStack `<Link>` instead of the plain `<a>` this component emits by
   * default. Wins over `playerHref` when both are given. Not present in the
   * Svelte original — SvelteKit intercepted plain anchors, TanStack Router
   * does not.
   */
  renderPlayerLink?: (
    player: MatchTeamPlayerResponse,
    name: string
  ) => ReactNode;
}

// ⚠️ Username FIRST here — the opposite of `getPlayerDisplayName` in lib/utils.
// e2e asserts a match card does not contain display names. Do not unify.
const playerName = (p: { displayName?: string; username?: string }) =>
  p.username ?? p.displayName ?? 'Unknown';

export function MatchCard({
  match,
  showMmr = false,
  playerHref,
  renderPlayerLink,
}: MatchCardProps) {
  // Index-based with a positional fallback, not array order.
  const team1 = match.teams.find((t) => t.index === 0) ?? match.teams[0];
  const team2 = match.teams.find((t) => t.index === 1) ?? match.teams[1];

  const name = (player: MatchTeamPlayerResponse) => {
    const label = playerName(player);
    if (renderPlayerLink) return renderPlayerLink(player, label);
    if (playerHref)
      return (
        <a className="hover:underline" href={playerHref(player.leaguePlayerId)}>
          {label}
        </a>
      );
    return <span>{label}</span>;
  };

  return (
    <Card>
      <div className="flex flex-row items-center gap-1 px-2 py-1 md:px-4 md:py-2">
        <div
          className={cn(
            'flex flex-1 flex-row items-center gap-4',
            team1?.isWinner && 'text-primary'
          )}
        >
          <p className="min-w-[1.5ch] text-4xl font-extrabold">
            {team1?.score === 0 ? '🥚' : team1?.score}
          </p>
          <div className="flex flex-1 flex-col items-start">
            {(team1?.players ?? []).map((player) => (
              <p className="space-x-1" key={player.id}>
                {name(player)}
                {showMmr ? <MmrDelta delta={player.ratingDelta} /> : null}
              </p>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center">
          vs.
          {match.playedAt ? (
            <p
              className="text-muted-foreground"
              title={new Date(match.playedAt).toDateString()}
            >
              {new Date(match.playedAt).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            'flex flex-1 flex-row items-center gap-4',
            team2?.isWinner && 'text-primary'
          )}
        >
          {/* Team 2 mirrors team 1: delta first, then the name. */}
          <div className="flex flex-1 flex-col items-end">
            {(team2?.players ?? []).map((player) => (
              <p className="space-x-1" key={player.id}>
                {showMmr ? <MmrDelta delta={player.ratingDelta} /> : null}
                {name(player)}
              </p>
            ))}
          </div>
          <p className="min-w-[1.5ch] text-right text-4xl font-extrabold">
            {team2?.score === 0 ? '🥚' : team2?.score}
          </p>
        </div>
      </div>
    </Card>
  );
}
