import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { PlayerButton } from '@/components/player-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHydratedInputValue } from '@/hooks/use-hydrated-input-value';
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
 * One player slot: a filter box that turns into a chip once a player is picked.
 *
 * Two search rules are deliberate and asserted by e2e:
 *  - suggestions only appear at `filter.length > 1`, so a single character
 *    shows nothing at all (not even "No players found");
 *  - "Recent players" only appears while the filter is empty.
 *
 * League players are searched by display name and username; org members who are
 * *not yet* league players are searched by those plus email.
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
  // The slot is server-rendered, so it can be typed into before hydration.
  const filterRef = useHydratedInputValue(filter, setFilter);

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

  const selectPlayer = (player: LeaguePlayerResponse) => {
    onChange({ kind: 'league', player });
    setFilter('');
  };

  const selectMember = (member: OrganizationMemberResponse) => {
    onChange({ kind: 'member', member });
    setFilter('');
  };

  const reset = () => {
    onChange(null);
    setFilter('');
  };

  return (
    <div className="flex flex-col gap-2">
      <h4>{label}</h4>
      {value === null ? (
        <>
          <Input
            ref={filterRef}
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
            placeholder="Filter..."
            autoFocus={autofocus || undefined}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="none"
          />
          {filter.length === 0 && latestPlayers.length > 0 ? (
            <>
              <p className="text-sm">Recent players</p>
              <ul>
                {latestPlayers.map((player) => (
                  <li className="mb-1 last:mb-0" key={player.id}>
                    <PlayerButton
                      user={player}
                      onClick={() => selectPlayer(player)}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {filter.length > 1 ? (
            matchedPlayers.length > 0 || matchedMembers.length > 0 ? (
              <ul>
                {matchedPlayers.map((player) => (
                  <li className="mb-1" key={player.id}>
                    <PlayerButton
                      user={player}
                      onClick={() => selectPlayer(player)}
                    />
                  </li>
                ))}
                {matchedMembers.length > 0 ? (
                  <>
                    <li className="mb-1 mt-2 text-xs text-muted-foreground">
                      Org members not yet in league
                    </li>
                    {matchedMembers.map((member) => (
                      <li className="mb-1" key={member.id}>
                        <PlayerButton
                          user={{
                            displayName: member.displayName,
                            username: member.username,
                          }}
                          onClick={() => selectMember(member)}
                        />
                      </li>
                    ))}
                  </>
                ) : null}
              </ul>
            ) : (
              <div className="flex flex-col items-start gap-1">
                <p className="text-sm">No players found</p>
                <Button type="button" onClick={() => onCreateUser(filter)}>
                  Add new player
                </Button>
              </div>
            )
          ) : null}
        </>
      ) : (
        <div className="flex w-full items-center gap-1 rounded-md border border-input px-3 py-2">
          <div className="flex flex-1 flex-col gap-1">
            {value.kind === 'league' ? (
              <>
                <p className="line-clamp-1 text-sm md:text-base">
                  {playerName(value.player)}
                </p>
                {value.player.displayName && value.player.username ? (
                  <p className="text-xs">{value.player.username}</p>
                ) : null}
              </>
            ) : value.kind === 'member' ? (
              <>
                <p className="line-clamp-1 text-sm md:text-base">
                  {playerName(value.member)}
                </p>
                <p className="text-xs">Org member · joining league</p>
              </>
            ) : (
              <>
                <p className="line-clamp-1 text-sm md:text-base">
                  {value.displayName}
                </p>
                <p className="text-xs">
                  {value.email ? `New player · ${value.email}` : 'New player'}
                </p>
              </>
            )}
          </div>
          <Button
            type="button"
            className="-mr-1 h-7 w-7 rounded p-1 text-sm"
            onClick={reset}
            variant="ghost"
          >
            <X className="h-full w-full" />
          </Button>
        </div>
      )}
    </div>
  );
}
