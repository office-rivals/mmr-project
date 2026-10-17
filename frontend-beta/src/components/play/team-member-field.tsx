import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { PlayerAvatar } from '@/components/player-avatar';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from '@/components/ui/combobox';
import { useHydratedInputValue } from '@/hooks/use-hydrated-input-value';
import { useInlineList } from '@/hooks/use-inline-list';
import type {
  LeaguePlayerResponse,
  OrganizationMemberResponse,
} from '@/api-v3';

export type SlotValue =
  | { kind: 'league'; player: LeaguePlayerResponse }
  | { kind: 'member'; member: OrganizationMemberResponse }
  | { kind: 'new'; displayName: string; username: string; email: string }
  | null;

interface TeamMemberFieldProps {
  label: string;
  value: SlotValue;
  onChange: (value: SlotValue) => void;
  leaguePlayers: LeaguePlayerResponse[];
  orgMembers: OrganizationMemberResponse[];
  latestPlayerIds: string[];
  /** `league:<id>` / `member:<id>` strings already used by another slot. */
  excludeIds: string[];
  onCreateUser: (suggested: string) => void;
  autofocus?: boolean;
}

const playerName = (p: {
  displayName?: string;
  username?: string;
  email?: string;
}) => p.displayName ?? p.username ?? p.email ?? 'Unknown';

/**
 * One player slot: a combobox that turns into a chip once a player is picked.
 *
 * Two search rules are deliberate and asserted by e2e:
 *  - suggestions only appear at `filter.length > 1`, so a single character
 *    shows nothing at all (not even "No players found");
 *  - "Recent players" only appears while the filter is empty.
 *
 * League players are searched by display name and username; org members who are
 * *not yet* league players are searched by those plus email.
 *
 * Enter never reaches the form — implicit submission would post an empty match.
 * It picks the top typed match, or an option the user arrowed to; an untouched
 * list of recents is not a choice, which is why the first option is only
 * auto-highlighted once two characters are typed.
 */
export function TeamMemberField({
  label,
  value,
  onChange,
  leaguePlayers,
  orgMembers,
  latestPlayerIds,
  excludeIds,
  onCreateUser,
  autofocus = false,
}: TeamMemberFieldProps) {
  const [filter, setFilter] = useState('');

  const matches = useMemo(() => {
    const needle = filter.toLowerCase();
    return (text: string) => text.toLowerCase().includes(needle);
  }, [filter]);

  const matchedPlayers = useMemo(
    () =>
      leaguePlayers.filter(
        (p) =>
          !excludeIds.includes(`league:${p.id}`) &&
          (matches(p.displayName ?? '') || matches(p.username ?? ''))
      ),
    [leaguePlayers, excludeIds, matches]
  );

  const leagueMembershipIds = useMemo(
    () => new Set(leaguePlayers.map((p) => p.organizationMembershipId)),
    [leaguePlayers]
  );

  const matchedMembers = useMemo(
    () =>
      orgMembers.filter(
        (m) =>
          !leagueMembershipIds.has(m.id) &&
          !excludeIds.includes(`member:${m.id}`) &&
          (matches(m.displayName ?? '') ||
            matches(m.username ?? '') ||
            matches(m.email ?? ''))
      ),
    [orgMembers, leagueMembershipIds, excludeIds, matches]
  );

  const latestPlayers = useMemo(
    () =>
      latestPlayerIds
        .map((id) => leaguePlayers.find((p) => p.id === id))
        .filter((p): p is LeaguePlayerResponse => !!p)
        .filter((p) => !excludeIds.includes(`league:${p.id}`))
        .slice(0, 4),
    [latestPlayerIds, leaguePlayers, excludeIds]
  );

  // Option values reuse the `league:` / `member:` encoding the parent already
  // uses for excludeIds and the hidden form fields. In render order, so
  // options[0] is the top suggestion.
  const options = useMemo(
    () =>
      filter.length === 0
        ? latestPlayers.map((p) => `league:${p.id}`)
        : filter.length > 1
          ? [
              ...matchedPlayers.map((p) => `league:${p.id}`),
              ...matchedMembers.map((m) => `member:${m.id}`),
            ]
          : [],
    [filter, latestPlayers, matchedPlayers, matchedMembers]
  );

  const findPlayer = (optionValue: string) =>
    leaguePlayers.find((p) => `league:${p.id}` === optionValue);
  const findMember = (optionValue: string) =>
    orgMembers.find((m) => `member:${m.id}` === optionValue);

  const list = useInlineList({
    // The browser focuses an autofocused input before React attaches its
    // focus handler, so the focus event never reaches us — start open instead.
    initialOpen: autofocus,
    onEscape: () => setFilter(''),
  });

  const select = (optionValue: string) => {
    const player = findPlayer(optionValue);
    const member = player ? undefined : findMember(optionValue);
    if (player) onChange({ kind: 'league', player });
    else if (member) onChange({ kind: 'member', member });
    else return;
    setFilter('');
    list.setOpen(false);
  };

  // The slot is server-rendered, so it can be typed into before hydration.
  const filterRef = useHydratedInputValue(filter, (fromDom) => {
    setFilter(fromDom);
    list.setOpen(true);
  });

  const reset = () => {
    onChange(null);
    setFilter('');
  };

  const option = (
    optionValue: string,
    user: { displayName?: string; username?: string }
  ) => (
    <ComboboxItem key={optionValue} value={optionValue}>
      <p className="line-clamp-1 text-sm md:text-base">
        {user.displayName ?? user.username ?? 'Unknown'}
      </p>
      {user.displayName != null && user.username != null ? (
        <p className="text-xs">{user.username}</p>
      ) : null}
    </ComboboxItem>
  );

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs text-muted-foreground">{label}</h4>
      {value === null ? (
        <Combobox
          inline
          open
          items={options}
          filteredItems={options}
          value={null}
          onValueChange={(picked) => {
            if (typeof picked === 'string') select(picked);
          }}
          inputValue={filter}
          onInputValueChange={(next, details) => {
            // A pick writes the option's label into the input; the slot turns
            // into a chip instead.
            if (details.reason === 'item-press') return;
            setFilter(next);
            list.setOpen(true);
          }}
          itemToStringLabel={(optionValue: string) => {
            const user = findPlayer(optionValue) ?? findMember(optionValue);
            return user ? playerName(user) : optionValue;
          }}
          autoHighlight={filter.length > 1}
        >
          <ComboboxInput
            ref={filterRef}
            placeholder="Filter..."
            autoFocus={autofocus || undefined}
            {...list.inputProps}
          />
          {list.open ? (
            <div {...list.listProps} className="flex flex-col gap-1">
              {filter.length === 0 && latestPlayers.length > 0 ? (
                <ComboboxList>
                  <ComboboxGroup>
                    <ComboboxLabel className="text-[10px] font-medium tracking-[0.14em] uppercase">
                      Recent players
                    </ComboboxLabel>
                    {latestPlayers.map((player) =>
                      option(`league:${player.id}`, player)
                    )}
                  </ComboboxGroup>
                </ComboboxList>
              ) : filter.length > 1 && options.length > 0 ? (
                <ComboboxList>
                  {matchedPlayers.map((player) =>
                    option(`league:${player.id}`, player)
                  )}
                  {matchedMembers.length > 0 ? (
                    <ComboboxGroup>
                      <ComboboxLabel className="mt-1">
                        Org members not yet in league
                      </ComboboxLabel>
                      {matchedMembers.map((member) =>
                        option(`member:${member.id}`, {
                          displayName: member.displayName,
                          username: member.username,
                        })
                      )}
                    </ComboboxGroup>
                  ) : null}
                </ComboboxList>
              ) : filter.length > 1 ? (
                <div className="flex flex-col items-start gap-1">
                  <p className="text-sm">No players found</p>
                  <Button type="button" onClick={() => onCreateUser(filter)}>
                    Add new player
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </Combobox>
      ) : (
        <div className="flex w-full items-center gap-2 rounded-md border border-input bg-card px-2.5 py-2">
          <PlayerAvatar
            name={
              value.kind === 'league'
                ? playerName(value.player)
                : value.kind === 'member'
                  ? playerName(value.member)
                  : value.displayName
            }
            dashed={value.kind !== 'league'}
            className="size-8 text-[10px]"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            {value.kind === 'league' ? (
              value.player.displayName && value.player.username ? (
                // Phone columns are narrow: the short handle leads there, and
                // the full name stays on hover.
                <>
                  <p
                    className="line-clamp-1 text-sm font-semibold"
                    title={value.player.displayName}
                  >
                    <span className="hidden sm:inline">
                      {value.player.displayName}
                    </span>
                    <span className="sm:hidden">{value.player.username}</span>
                  </p>
                  <p className="hidden truncate text-xs text-muted-foreground sm:block">
                    {value.player.username}
                  </p>
                </>
              ) : (
                <p className="line-clamp-1 text-sm font-semibold">
                  {playerName(value.player)}
                </p>
              )
            ) : value.kind === 'member' ? (
              <>
                <p className="line-clamp-1 text-sm font-semibold">
                  {playerName(value.member)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Org member · joining league
                </p>
              </>
            ) : (
              <>
                <p className="line-clamp-1 text-sm font-semibold">
                  {value.displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {value.email ? `New player · ${value.email}` : 'New player'}
                </p>
              </>
            )}
          </div>
          {/* A full touch target, pulled into the chip's padding. */}
          <Button
            type="button"
            className="-my-1.5 -mr-1.5 size-11 shrink-0 rounded p-0 text-sm text-muted-foreground"
            onClick={reset}
            variant="ghost"
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
