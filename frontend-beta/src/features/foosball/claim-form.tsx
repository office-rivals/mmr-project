import { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { NewPlayerDialog } from '@/components/play/new-player-dialog';
import { TeamMemberField } from '@/components/play/team-member-field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { readStorage, writeStorage } from '@/lib/storage';
import type { NewPlayerDraft } from '@/components/play/new-player-dialog';
import type { SlotValue } from '@/components/play/team-member-field';
import type {
  LeaguePlayerResponse,
  OrganizationMemberResponse,
  SubmitMatchPlayerRequest,
} from '@/api-v3';
import type {
  ClaimTableMatchRequest,
  TableEnd,
  TableMatchResponse,
  TablePlayerResponse,
  TableResponse,
} from './api';

type LineUp = {
  playersA: TablePlayerResponse[];
  playersB: TablePlayerResponse[];
};

// Shared with the submit page, so recents follow the player between the two.
const latestPlayersKey = (leagueId: string) =>
  `latestLeaguePlayerIds:${leagueId}`;

const MAX_CHIPS = 6;

export type Slots = Record<TableEnd, SlotValue[]>;

export function toPlayerRequest(
  value: NonNullable<SlotValue>
): SubmitMatchPlayerRequest {
  if (value.kind === 'league') return { leaguePlayerId: value.player.id };
  if (value.kind === 'member')
    return { organizationMembershipId: value.member.id };
  return {
    newPlayer: {
      displayName: value.displayName,
      username: value.username || undefined,
      email: value.email || undefined,
    },
  };
}

const exclusion = (value: SlotValue) =>
  value?.kind === 'league'
    ? `league:${value.player.id}`
    : value?.kind === 'member'
      ? `member:${value.member.id}`
      : null;

/** One-tap picks: you first, then recent players, minus anyone placed. */
export function chipPlayers(
  players: LeaguePlayerResponse[],
  myId: string | null,
  recentIds: string[],
  placedIds: string[]
): LeaguePlayerResponse[] {
  const ids = [...new Set([myId, ...recentIds])].filter(
    (id): id is string => !!id && !placedIds.includes(id)
  );
  return ids
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is LeaguePlayerResponse => !!p)
    .slice(0, MAX_CHIPS);
}

/**
 * The previous game's line-up as slots, or null when it can't be reused: a
 * different team size, or a player who isn't in this league.
 */
export function slotsFromMatch(
  previous: LineUp | null,
  players: LeaguePlayerResponse[],
  teamSize: number
): Slots | null {
  if (!previous) return null;
  const end = (side: TablePlayerResponse[]): SlotValue[] | null => {
    if (side.length !== teamSize) return null;
    const found = side.map((p) =>
      players.find((lp) => lp.id === p.leaguePlayerId)
    );
    return found.every(Boolean)
      ? found.map((player) => ({ kind: 'league', player: player! }))
      : null;
  };
  const A = end(previous.playersA);
  const B = end(previous.playersB);
  return A && B ? { A, B } : null;
}

/**
 * Who played a match the table already scored. Scores come from the goal
 * counters, so this is only "who was on which team". Columns lead with the
 * score (people remember "we won 10–7", not which end is "Red") and sit in
 * the order the scoreboard shows them.
 *
 * Mount with `key={leagueId}`: league player ids are league-scoped.
 */
export function ClaimForm({
  table,
  match,
  previousMatch,
  leagueId,
  teamSize,
  myLeaguePlayerId,
  players,
  members,
  submitting,
  onSubmit,
}: {
  table: TableResponse;
  match: TableMatchResponse;
  /** Last claimed game at this table, for "Same players". */
  previousMatch: LineUp | null;
  leagueId: string;
  teamSize: number;
  myLeaguePlayerId: string | null;
  players: LeaguePlayerResponse[];
  members: OrganizationMemberResponse[];
  submitting: boolean;
  onSubmit: (request: ClaimTableMatchRequest) => void;
}) {
  const empty = () => Array<SlotValue>(teamSize).fill(null);
  const [slots, setSlots] = useState<Slots>({ A: empty(), B: empty() });
  const [latestPlayerIds, setLatestPlayerIds] = useState<string[]>([]);
  const [dialogFor, setDialogFor] = useState<[TableEnd, number] | null>(null);
  const [draft, setDraft] = useState<NewPlayerDraft>({
    displayName: '',
    username: '',
    email: '',
    error: '',
  });

  useEffect(() => {
    const stored = readStorage('local', latestPlayersKey(leagueId));
    if (stored) setLatestPlayerIds(stored.split(',').filter(Boolean));
  }, [leagueId]);

  const setSlot = (end: TableEnd, i: number, value: SlotValue) =>
    setSlots((s) => ({
      ...s,
      [end]: s[end].map((v, j) => (j === i ? value : v)),
    }));

  const all = [...slots.A, ...slots.B];
  const exclusions = all.map(exclusion).filter((v): v is string => !!v);
  const placedIds = all.flatMap((v) =>
    v?.kind === 'league' ? [v.player.id] : []
  );
  const chips = chipPlayers(
    players,
    myLeaguePlayerId,
    latestPlayerIds,
    placedIds
  );
  const sameAsLast = slotsFromMatch(previousMatch, players, teamSize);
  const complete = all.every((v) => v !== null);
  const ends: TableEnd[] =
    table.scoreboardLeftEnd === 'B' ? ['B', 'A'] : ['A', 'B'];

  const label = (end: TableEnd) =>
    end === 'A' ? table.endLabelA : table.endLabelB;
  const score = (end: TableEnd) => (end === 'A' ? match.scoreA : match.scoreB);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!complete || submitting) return;
    writeStorage(
      'local',
      latestPlayersKey(leagueId),
      [...placedIds, ...latestPlayerIds.filter((id) => !placedIds.includes(id))]
        .slice(0, 10)
        .join(',')
    );
    onSubmit({
      teams: (['A', 'B'] as const).map((end) => ({
        end,
        players: slots[end].map((v) => toPlayerRequest(v!)),
      })),
    });
  };

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex gap-2">
          {sameAsLast && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setSlots(sameAsLast)}
            >
              Same players as last game
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            aria-label="Swap teams"
            onClick={() => setSlots((s) => ({ A: s.B, B: s.A }))}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-3">
          {ends.map((end, endIndex) => {
            const next = slots[end].indexOf(null);
            return (
              <div key={end} className="flex min-w-0 flex-1 flex-col gap-4">
                <div className="text-center">
                  <div className="text-5xl font-bold tabular-nums">
                    {score(end)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {label(end)} team
                  </div>
                </div>
                {next !== -1 && chips.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {chips.map((player) => (
                      <Button
                        key={player.id}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setSlot(end, next, { kind: 'league', player })
                        }
                      >
                        {player.id === myLeaguePlayerId
                          ? 'Me'
                          : (player.displayName ?? player.username)}
                      </Button>
                    ))}
                  </div>
                )}
                {slots[end].map((value, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-md',
                      value === null &&
                        'outline-1 outline-offset-4 outline-muted-foreground/50 outline-dashed'
                    )}
                  >
                    <TeamMemberField
                      label={`${label(end)} player ${i + 1}`}
                      autofocus={
                        endIndex === 0 && i === 0 && chips.length === 0
                      }
                      value={value}
                      onChange={(v) => setSlot(end, i, v)}
                      leaguePlayers={players}
                      orgMembers={members}
                      latestPlayerIds={latestPlayerIds}
                      excludeIds={exclusions}
                      onCreateUser={(suggested) => {
                        setDraft({
                          displayName: suggested,
                          username: '',
                          email: '',
                          error: '',
                        });
                        setDialogFor([end, i]);
                      }}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <Button type="submit" size="lg" disabled={!complete || submitting}>
          Save match
        </Button>
      </form>

      <NewPlayerDialog
        open={dialogFor !== null}
        draft={draft}
        onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        onOpenChange={(open) => !open && setDialogFor(null)}
        onSave={() => {
          if (!dialogFor) return;
          if (draft.displayName.trim() === '') {
            setDraft((d) => ({ ...d, error: 'Display name is required' }));
            return;
          }
          setSlot(dialogFor[0], dialogFor[1], {
            kind: 'new',
            displayName: draft.displayName.trim(),
            username: draft.username.trim(),
            email: draft.email.trim(),
          });
          setDialogFor(null);
        }}
      />
    </>
  );
}

/**
 * The match a deep link points at. Only ids come from the URL — the score is
 * always the server's. Without a match id: the newest claimable match, else
 * the unlinked game still running (claiming finishes it).
 */
export function pickClaimMatch(
  claimable: TableMatchResponse[],
  live: TableMatchResponse | null,
  matchId: string | undefined
): TableMatchResponse | null {
  const runningUnlinked =
    live?.status === 'Live' &&
    !live.activeMatchId &&
    live.scoreA + live.scoreB > 0
      ? live
      : null;
  if (matchId) {
    return (
      claimable.find((m) => m.id === matchId) ??
      (runningUnlinked?.id === matchId ? runningUnlinked : null)
    );
  }
  return claimable[0] ?? runningUnlinked;
}
