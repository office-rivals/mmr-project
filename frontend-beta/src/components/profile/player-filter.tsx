import { useState } from 'react';
import { PlayerButton } from '@/components/player-button';
import { Input } from '@/components/ui/input';
import type { LeaguePlayerResponse } from '@/api-v3/models';

interface PlayerFilterProps {
  /** The whole league roster — including the profile player and already-picked ones. */
  players: LeaguePlayerResponse[];
  onSelected: (playerId: string) => void;
  autoFocus?: boolean;
}

/**
 * Port of `player/[id]/components/filter.svelte`.
 *
 * Two details that are easy to lose: the suggestion list appears only from the
 * **second** typed character, and the haystack is `displayName + ' ' +
 * username`, so a query spanning both fields ("ada lovelace") still matches.
 *
 * Duplicate picks are the caller's problem to dedupe (the Svelte version
 * pushed a duplicate id and crashed its keyed loop).
 */
export function PlayerFilter({
  players,
  onSelected,
  autoFocus = false,
}: PlayerFilterProps) {
  const [filter, setFilter] = useState('');

  const filtered = players.filter((p) => {
    const name = (p.displayName ?? '') + ' ' + (p.username ?? '');
    return name.toLowerCase().includes(filter.toLowerCase());
  });

  const select = (player: LeaguePlayerResponse) => {
    onSelected(player.id);
    setFilter('');
  };

  return (
    <div className="relative flex flex-col gap-2">
      <Input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter..."
        autoFocus={autoFocus ? autoFocus : undefined}
      />
      {filter.length > 1 ? (
        filtered.length > 0 ? (
          <ul className="absolute top-[100%] z-10 mt-3 w-full space-y-2">
            {filtered.map((player) => (
              <li key={player.id}>
                <PlayerButton
                  user={player}
                  onClick={() => select(player)}
                  className="bg-background"
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <p className="text-sm">No players found</p>
          </div>
        )
      ) : null}
    </div>
  );
}
