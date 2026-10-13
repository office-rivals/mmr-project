import { useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { PlayerAvatar } from '@/components/player-avatar';
import { PlayerButton } from '@/components/player-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHydratedInputValue } from '@/hooks/use-hydrated-input-value';
import { usePlayerCombobox } from '@/hooks/use-player-combobox';
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
 * list of recents is not a choice.
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
  const headingId = useId();
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

  const select = (optionValue: string) => {
    const player = leaguePlayers.find((p) => `league:${p.id}` === optionValue);
    if (player) {
      onChange({ kind: 'league', player });
      setFilter('');
      return;
    }
    const member = orgMembers.find((m) => `member:${m.id}` === optionValue);
    if (member) {
      onChange({ kind: 'member', member });
      setFilter('');
    }
  };

  const {
    open,
    clearHighlight,
    onFilterInput,
    inputProps,
    listboxProps,
    getOptionProps,
  } = usePlayerCombobox({
    options,
    filterLength: filter.length,
    // Recents sit on screen with an empty filter, so only an arrowed highlight
    // authorises Enter.
    requireArrow: true,
    minFilterLength: 2,
    // The browser focuses an autofocused input before this component's focus
    // handler exists, so the focus event never reaches us — start open instead.
    initialOpen: autofocus,
    onSelect: select,
    onEscape: () => setFilter(''),
  });

  // The slot is server-rendered, so it can be typed into before hydration.
  const filterRef = useHydratedInputValue(filter, (fromDom) => {
    setFilter(fromDom);
    onFilterInput();
  });

  const reset = () => {
    onChange(null);
    setFilter('');
    // The slot goes back to an untouched recents list, so the arrow the user
    // pressed before the last pick must not still authorise Enter.
    clearHighlight();
  };

  const option = (
    optionValue: string,
    user: { displayName?: string; username?: string }
  ) => (
    <PlayerButton
      key={optionValue}
      {...getOptionProps(optionValue)}
      user={user}
      className="data-[highlighted]:border-primary data-[highlighted]:bg-muted"
    />
  );

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs text-muted-foreground">{label}</h4>
      {value === null ? (
        <>
          <Input
            ref={filterRef}
            value={filter}
            onChange={(e) => {
              setFilter(e.currentTarget.value);
              // Covers input that arrives without a keydown (paste, autofill).
              onFilterInput();
            }}
            placeholder="Filter..."
            autoFocus={autofocus || undefined}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="none"
            {...inputProps}
          />
          {open ? (
            <div {...listboxProps} className="flex flex-col gap-1">
              {filter.length === 0 && latestPlayers.length > 0 ? (
                <div
                  role="group"
                  aria-labelledby={headingId}
                  className="flex flex-col gap-1"
                >
                  <div
                    id={headingId}
                    className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase"
                  >
                    Recent players
                  </div>
                  {latestPlayers.map((player) =>
                    option(`league:${player.id}`, player)
                  )}
                </div>
              ) : filter.length > 1 && options.length > 0 ? (
                <>
                  {matchedPlayers.map((player) =>
                    option(`league:${player.id}`, player)
                  )}
                  {matchedMembers.length > 0 ? (
                    <div
                      role="group"
                      aria-labelledby={`${headingId}-members`}
                      className="flex flex-col gap-1"
                    >
                      <div
                        id={`${headingId}-members`}
                        className="mt-1 text-xs text-muted-foreground"
                      >
                        Org members not yet in league
                      </div>
                      {matchedMembers.map((member) =>
                        option(`member:${member.id}`, {
                          displayName: member.displayName,
                          username: member.username,
                        })
                      )}
                    </div>
                  ) : null}
                </>
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
        </>
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
              <>
                <p className="line-clamp-1 text-sm font-semibold">
                  {playerName(value.player)}
                </p>
                {value.player.displayName && value.player.username ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {value.player.username}
                  </p>
                ) : null}
              </>
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
          <Button
            type="button"
            className="h-7 w-7 shrink-0 rounded p-1 text-sm text-muted-foreground"
            onClick={reset}
            variant="ghost"
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <X className="h-full w-full" />
          </Button>
        </div>
      )}
    </div>
  );
}
