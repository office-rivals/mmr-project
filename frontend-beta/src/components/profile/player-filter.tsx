import { useMemo, useState } from 'react';
import { PlayerButton } from '@/components/player-button';
import { Input } from '@/components/ui/input';
import { useHydratedInputValue } from '@/hooks/use-hydrated-input-value';
import { usePlayerCombobox } from '@/hooks/use-player-combobox';
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
 * Keyboard: Enter picks the highlighted option, else the top match, and never
 * reaches an enclosing form; Escape clears the box and closes the list.
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

  const filtered = useMemo(
    () =>
      players.filter((p) => {
        const name = (p.displayName ?? '') + ' ' + (p.username ?? '');
        return name.toLowerCase().includes(filter.toLowerCase());
      }),
    [players, filter]
  );

  // The list is only ever on screen from the second character, so every option
  // is a typed match — no "an untouched list is not a choice" caveat here.
  const options = useMemo(
    () => (filter.length > 1 ? filtered.map((p) => p.id) : []),
    [filter, filtered]
  );

  const {
    open,
    setOpen,
    inputProps,
    listboxProps,
    getOptionProps,
    onFilterInput,
  } = usePlayerCombobox({
    options,
    filterLength: filter.length,
    requireArrow: false,
    minFilterLength: 2,
    // An autofocused input is focused by the browser before this component's
    // focus handler is attached, so the focus event never reaches us.
    initialOpen: autoFocus,
    onSelect: (playerId) => {
      onSelected(playerId);
      setFilter('');
      setOpen(false);
      // The picker stays mounted across picks and the box is ready for the
      // next name, so keep the caret where the user left it.
      inputRef.current?.focus();
    },
    onEscape: () => setFilter(''),
  });

  // The filter is server-rendered, so it can be typed into before hydration.
  const inputRef = useHydratedInputValue(filter, (fromDom) => {
    setFilter(fromDom);
    onFilterInput();
  });

  return (
    <div className="relative flex flex-col gap-2">
      <Input
        ref={inputRef}
        value={filter}
        onChange={(event) => {
          setFilter(event.target.value);
          // Covers input that arrives without a keydown (paste, autofill).
          onFilterInput();
        }}
        placeholder="Filter..."
        autoFocus={autoFocus ? autoFocus : undefined}
        {...inputProps}
      />
      {open && filter.length > 1 ? (
        <div className="absolute top-[100%] z-10 mt-3 w-full">
          {filtered.length > 0 ? (
            <div {...listboxProps} className="flex flex-col gap-2">
              {filtered.map((player) => (
                <PlayerButton
                  key={player.id}
                  {...getOptionProps(player.id)}
                  user={player}
                  className="bg-background data-[highlighted]:border-primary data-[highlighted]:bg-muted"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-1">
              <p className="text-sm">No players found</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
