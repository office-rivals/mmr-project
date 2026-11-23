import { useMemo, useState } from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { useHydratedInputValue } from '@/hooks/use-hydrated-input-value';
import { useInlineList } from '@/hooks/use-inline-list';
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

  const list = useInlineList({
    // An autofocused input is focused by the browser before this component's
    // focus handler is attached, so the focus event never reaches us.
    initialOpen: autoFocus,
    onEscape: () => setFilter(''),
  });

  // The filter is server-rendered, so it can be typed into before hydration.
  const inputRef = useHydratedInputValue(filter, (fromDom) => {
    setFilter(fromDom);
    list.setOpen(true);
  });

  return (
    <Combobox
      inline
      open
      items={options}
      filteredItems={options}
      value={null}
      onValueChange={(playerId) => {
        if (typeof playerId !== 'string') return;
        onSelected(playerId);
        setFilter('');
        list.setOpen(false);
      }}
      inputValue={filter}
      onInputValueChange={(next, details) => {
        // The picker stays mounted across picks and the box is ready for the
        // next name, so a pick must not write the label into it.
        if (details.reason === 'item-press') return;
        setFilter(next);
        list.setOpen(true);
      }}
      itemToStringLabel={(playerId: string) => {
        const player = players.find((p) => p.id === playerId);
        return player?.displayName ?? player?.username ?? playerId;
      }}
      autoHighlight
    >
      <div className="relative flex flex-col gap-2">
        <ComboboxInput
          ref={inputRef}
          placeholder="Filter..."
          autoFocus={autoFocus ? autoFocus : undefined}
          {...list.inputProps}
        />
        {list.open && filter.length > 1 ? (
          <div
            {...list.listProps}
            className="absolute top-[100%] z-10 mt-3 w-full"
          >
            {filtered.length > 0 ? (
              <ComboboxList className="gap-2">
                {filtered.map((player) => (
                  <ComboboxItem
                    key={player.id}
                    value={player.id}
                    className="bg-background"
                  >
                    <p className="line-clamp-1 text-sm md:text-base">
                      {player.displayName ?? player.username ?? 'Unknown'}
                    </p>
                    {player.displayName != null && player.username != null ? (
                      <p className="text-xs">{player.username}</p>
                    ) : null}
                  </ComboboxItem>
                ))}
              </ComboboxList>
            ) : (
              <div className="flex flex-col items-start gap-1">
                <p className="text-sm">No players found</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Combobox>
  );
}
