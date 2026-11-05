import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Clock,
  Copy,
  LoaderCircle,
  Share2,
  Users,
  X,
} from 'lucide-react';
import { PlayerAvatar } from '@/components/player-avatar';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  ACCEPTANCE_WINDOW_SECONDS,
  canRemoveParticipant,
  canRespond,
  canTakeControl,
  endedInviteMessage,
  findParticipant,
  formatCountdown,
  inviteLinkPath,
  isCreator,
  managedParticipants,
  openSpots,
  reopenedMessage,
  secondsUntil,
} from '@/lib/game-invite';
import {
  gameInviteActionFn,
  getCurrentGameInviteFn,
  getGameInviteFn,
  type GameInviteActionInput,
  type GameInviteActionName,
  type GameInviteActionResult,
} from '@/lib/game-invite-actions';
import { cn, getPlayerDisplayName } from '@/lib/utils';
import {
  AcceptanceStatus,
  GameInviteStatus,
  type GameInviteParticipantResponse,
  type GameInviteResponse,
  type LeaguePlayerResponse,
} from '@/api-v3';

export const gameInviteQueryKey = (orgId: string, leagueId: string) =>
  ['league', orgId, leagueId, 'gameInvite'] as const;

export const gameInviteDetailQueryKey = (
  orgId: string,
  leagueId: string,
  inviteId: string
) => [...gameInviteQueryKey(orgId, leagueId), inviteId] as const;

/**
 * The viewer's current invite in a league. Shared by the Play page and the
 * section, so both read one cache entry. Polls while the page is open; focus
 * and reconnect refetch by default.
 */
export function useGameInviteQuery(
  orgId: string,
  leagueId: string,
  seedInvite: GameInviteResponse | null,
  inviteId?: string
) {
  return useQuery({
    queryKey: inviteId
      ? gameInviteDetailQueryKey(orgId, leagueId, inviteId)
      : gameInviteQueryKey(orgId, leagueId),
    queryFn: () =>
      inviteId
        ? getGameInviteFn({ data: { orgId, leagueId, inviteId } })
        : getCurrentGameInviteFn({ data: { orgId, leagueId } }),
    initialData: seedInvite,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === GameInviteStatus.Started ||
        status === GameInviteStatus.Ended
        ? false
        : 2000;
    },
    staleTime: 0,
    retry: false,
  });
}

interface GameInviteSectionProps {
  orgId: string;
  leagueId: string;
  leaguePlayerId: string | null;
  /** Existing league players the viewer may add. */
  leaguePlayers: LeaguePlayerResponse[];
  seedInvite: GameInviteResponse | null;
  /** The viewer is queued; a player can't be in the queue and an invite together. */
  inQueue: boolean;
  /** Keep a shared-link view tied to this invite, including its terminal state. */
  inviteId?: string;
  /** Sound for a found group, matching the queue's match-found cue. */
  playFoundSound?: () => void;
}

type Notice = { tone: 'success' | 'error' | 'info'; text: string };

export function GameInviteSection({
  orgId,
  leagueId,
  leaguePlayerId,
  leaguePlayers,
  seedInvite,
  inQueue,
  inviteId,
  playFoundSound,
}: GameInviteSectionProps) {
  const queryClient = useQueryClient();
  const queryKey = inviteId
    ? gameInviteDetailQueryKey(orgId, leagueId, inviteId)
    : gameInviteQueryKey(orgId, leagueId);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const inviteQuery = useGameInviteQuery(orgId, leagueId, seedInvite, inviteId);
  const invite = inviteQuery.data ?? null;
  const lastInvite = useRef(seedInvite);
  useEffect(() => {
    const previous = lastInvite.current;
    lastInvite.current = invite;
    if (inviteId || invite || !previous) return;
    let cancelled = false;
    // Current-invite reads release the commitment on completion or removal.
    // Read the remembered invite once so other clients also see why it ended.
    void getGameInviteFn({ data: { orgId, leagueId, inviteId: previous.id } })
      .then((finished) => {
        if (cancelled) return;
        setNotice({
          tone:
            finished?.status === GameInviteStatus.Started ? 'success' : 'info',
          text:
            finished?.status === GameInviteStatus.Started
              ? 'Everyone accepted. The match is live under Live now.'
              : finished?.status === GameInviteStatus.Ended
                ? endedInviteMessage(finished.endReason)
                : 'You are no longer in this game invite.',
        });
      })
      .catch(() => {
        if (!cancelled)
          setNotice({
            tone: 'info',
            text: 'You are no longer in this game invite.',
          });
      });
    return () => {
      cancelled = true;
    };
  }, [invite, inviteId, orgId, leagueId]);

  // A clock for the countdowns. It only runs while there is an invite to count.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!invite) return;
    setNow(Date.now());
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, [invite?.id]);

  // Announces a reopened invite, and plays the cue once when my acceptance starts.
  const previousStatus = useRef<GameInviteStatus | undefined>(undefined);
  useEffect(() => {
    const next = invite?.status;
    const reopened = reopenedMessage(previousStatus.current, invite);
    if (reopened) setNotice({ tone: 'info', text: reopened });
    if (
      next === GameInviteStatus.AwaitingAcceptance &&
      previousStatus.current !== next
    ) {
      const mine =
        invite && leaguePlayerId
          ? findParticipant(invite, leaguePlayerId)
          : undefined;
      if (mine?.acceptanceStatus === AcceptanceStatus.Pending)
        playFoundSound?.();
    }
    previousStatus.current = next;
  }, [invite?.status, invite?.id]);

  const act = useMutation({
    mutationFn: (input: Omit<GameInviteActionInput, 'orgId' | 'leagueId'>) =>
      gameInviteActionFn({ data: { ...input, orgId, leagueId } }),
    onSuccess: (result: GameInviteActionResult, variables) => {
      if (result.status === 'error') {
        setNotice({ tone: 'error', text: result.message });
        return;
      }
      const next = result.invite;
      const action = variables.action;
      if (
        !inviteId &&
        (action === 'leave' ||
          action === 'leaveAndRemoveManaged' ||
          !next ||
          next.status === GameInviteStatus.Ended ||
          next.status === GameInviteStatus.Started ||
          (leaguePlayerId && !findParticipant(next, leaguePlayerId)))
      )
        lastInvite.current = null;
      if (action === 'leave' || action === 'leaveAndRemoveManaged') {
        queryClient.setQueryData(queryKey, inviteId ? next : null);
        setNotice({ tone: 'info', text: 'You left the game invite.' });
        return;
      }
      if (!next || next.status === GameInviteStatus.Ended) {
        queryClient.setQueryData(queryKey, inviteId ? next : null);
        setNotice({
          tone: 'info',
          text: endedInviteMessage(next?.endReason),
        });
        return;
      }
      if (next.status === GameInviteStatus.Started) {
        // The match now lives under Live now, and this invite no longer holds spots.
        queryClient.setQueryData(queryKey, inviteId ? next : null);
        setNotice({
          tone: 'success',
          text: 'Everyone accepted. The match is live under Live now.',
        });
        return;
      }
      if (leaguePlayerId && !findParticipant(next, leaguePlayerId)) {
        queryClient.setQueryData(queryKey, inviteId ? next : null);
        setNotice({
          tone: 'info',
          text: 'You are no longer in this game invite.',
        });
        return;
      }
      queryClient.setQueryData(queryKey, next);
      setNotice(null);
    },
    onError: () =>
      setNotice({ tone: 'error', text: 'Something went wrong. Try again.' }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({
        queryKey: gameInviteQueryKey(orgId, leagueId),
      });
      await queryClient.invalidateQueries({ queryKey: ['game-invite-link'] });
      await queryClient.invalidateQueries({
        queryKey: ['league', orgId, leagueId, 'activeMatches'],
      });
    },
  });

  const run = (
    action: GameInviteActionName,
    extra: Partial<
      Omit<GameInviteActionInput, 'orgId' | 'leagueId' | 'action'>
    > = {}
  ) => {
    if (act.isPending) return;
    setNotice(null);
    act.mutate({ action, inviteId: invite?.id, ...extra });
  };

  const viewer = leaguePlayerId;
  const remaining = invite ? openSpots(invite) : 0;
  const managed = invite && viewer ? managedParticipants(invite, viewer) : [];

  return (
    <Card className="gap-0">
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users aria-hidden="true" className="size-5 text-primary" />
          Game invite
        </CardTitle>
        <CardDescription>
          Gather a group with a shared link. Everyone takes a spot, and teams
          are drawn once the group is full.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-5">
        {inviteQuery.isError ? (
          <Alert variant="destructive" role="alert">
            Could not refresh this invite. Reconnecting will refresh its status.
          </Alert>
        ) : null}
        {notice ? (
          <Alert
            variant={
              notice.tone === 'error'
                ? 'destructive'
                : notice.tone === 'success'
                  ? 'success'
                  : 'default'
            }
            role={notice.tone === 'error' ? 'alert' : 'status'}
          >
            {notice.text}
          </Alert>
        ) : null}

        {invite?.status === GameInviteStatus.Ended ? (
          <p role="status">{endedInviteMessage(invite.endReason)}</p>
        ) : invite?.status === GameInviteStatus.Started ? (
          <p role="status">
            Everyone accepted. The match is live under Live now in Play.
          </p>
        ) : !invite && inviteId ? (
          <p role="status">This game invite is no longer available.</p>
        ) : !viewer ? (
          <p className="text-sm text-muted-foreground">
            Join this league to start a game invite.
          </p>
        ) : !invite ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {inQueue
                ? 'Leave the queue before starting a game invite.'
                : 'Start one with the spots you know. Share the link with the people you want to play with.'}
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full text-base font-semibold"
              disabled={inQueue || act.isPending}
              onClick={() => run('create')}
            >
              Create game invite
            </Button>
          </div>
        ) : invite.status === GameInviteStatus.Waiting ? (
          <WaitingView
            invite={invite}
            viewer={viewer}
            now={now}
            remaining={remaining}
            leaguePlayers={leaguePlayers}
            pending={act.isPending}
            onRemove={(id) => run('removePlayer', { leaguePlayerId: id })}
            onAdd={(ids) => run('addPlayers', { leaguePlayerIds: ids })}
            onCancel={() => run('cancel')}
            onLeave={() => {
              if (managed.length > 0) setLeaveOpen(true);
              else run('leave');
            }}
          />
        ) : invite.status === GameInviteStatus.AwaitingAcceptance ? (
          <AcceptanceView
            invite={invite}
            viewer={viewer}
            now={now}
            pending={act.isPending}
            onRespond={(id, accept) =>
              run(accept ? 'accept' : 'decline', {
                leaguePlayerId: id,
                roundId: invite.roundId ?? undefined,
              })
            }
            onCancel={() => run('cancel')}
          />
        ) : null}

        {invite && viewer && canTakeControl(invite, viewer) ? (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
            <p className="text-sm">
              Someone added you. Take control to manage your own spot and
              responses.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={act.isPending}
              onClick={() => run('takeControl')}
            >
              Take control of my spot
            </Button>
          </div>
        ) : null}
      </CardContent>

      <LeaveDialog
        open={leaveOpen}
        managedNames={managed.map((p) => getPlayerDisplayName(p))}
        pending={act.isPending}
        onOpenChange={setLeaveOpen}
        onLeaveAlone={() => {
          setLeaveOpen(false);
          run('leave');
        }}
        onLeaveTogether={() => {
          setLeaveOpen(false);
          run('leaveAndRemoveManaged');
        }}
      />
    </Card>
  );
}

export function GameInviteShareLink({ shareCode }: { shareCode: string }) {
  const [origin, setOrigin] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}${inviteLinkPath(shareCode)}`;
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('Link copied.');
    } catch {
      setFeedback("Couldn't copy. Select the link and copy it.");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: 'Game invite', url });
    } catch (error) {
      // Dismissing the share sheet is not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFeedback("Couldn't open sharing. Copy the link instead.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="game-invite-link" className="text-sm font-semibold">
        Invite link
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="game-invite-link"
          readOnly
          value={url || inviteLinkPath(shareCode)}
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono text-xs"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={copy}>
            <Copy aria-hidden="true" />
            <span className="ml-1">Copy link</span>
          </Button>
          {canShare ? (
            <Button type="button" variant="outline" onClick={share}>
              <Share2 aria-hidden="true" />
              <span className="ml-1">Share</span>
            </Button>
          ) : null}
        </div>
      </div>
      <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
        {feedback}
      </p>
    </div>
  );
}

function WaitingView({
  invite,
  viewer,
  now,
  remaining,
  leaguePlayers,
  pending,
  onRemove,
  onAdd,
  onCancel,
  onLeave,
}: {
  invite: GameInviteResponse;
  viewer: string;
  now: number;
  remaining: number;
  leaguePlayers: LeaguePlayerResponse[];
  pending: boolean;
  onRemove: (leaguePlayerId: string) => void;
  onAdd: (leaguePlayerIds: string[]) => void;
  onCancel: () => void;
  onLeave: () => void;
}) {
  const creator = isCreator(invite, viewer);
  const expiresIn = secondsUntil(invite.expiresAt, now);
  const openSlots = Array.from({ length: remaining }, (_, i) => i);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <p className="font-semibold">
          {remaining === 0
            ? 'Full'
            : `${remaining} ${remaining === 1 ? 'spot' : 'spots'} left`}
        </p>
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <p className="flex items-center gap-1 text-muted-foreground">
          <Clock aria-hidden="true" className="size-4" />
          Open for{' '}
          <span className="tabular-nums">{formatCountdown(expiresIn)}</span>
        </p>
      </div>

      <GameInviteShareLink shareCode={invite.shareCode} />

      <section aria-label="Roster" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Players</h3>
        <ul className="flex flex-col divide-y rounded-lg border">
          {invite.participants.map((p) => (
            <ParticipantRow
              key={p.leaguePlayerId}
              participant={p}
              invite={invite}
              viewer={viewer}
              pending={pending}
              onRemove={onRemove}
            />
          ))}
          {openSlots.map((i) => (
            <li
              key={`open-${i}`}
              className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className="size-9 rounded-full border border-dashed border-muted-foreground/50"
              />
              Open spot
            </li>
          ))}
        </ul>
      </section>

      {remaining > 0 ? (
        <AddPlayers
          invite={invite}
          leaguePlayers={leaguePlayers}
          spotsLeft={remaining}
          pending={pending}
          onAdd={onAdd}
        />
      ) : null}

      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
        {creator ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel invite
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onLeave}
          >
            Leave invite
          </Button>
        )}
        <p className="text-xs text-muted-foreground sm:text-right">
          {creator
            ? 'Leaving or cancelling ends the invite for everyone.'
            : 'You can leave while the invite is open.'}
        </p>
      </div>
    </div>
  );
}

function ParticipantRow({
  participant,
  invite,
  viewer,
  pending,
  onRemove,
}: {
  participant: GameInviteParticipantResponse;
  invite: GameInviteResponse;
  viewer: string;
  pending: boolean;
  onRemove: (leaguePlayerId: string) => void;
}) {
  const name = getPlayerDisplayName(participant);
  const isMe = participant.leaguePlayerId === viewer;
  const representative = invite.participants.find(
    (p) => p.leaguePlayerId === participant.representativeLeaguePlayerId
  );
  const addedBy =
    !participant.isCreator &&
    participant.representativeLeaguePlayerId !== participant.leaguePlayerId
      ? getPlayerDisplayName(representative)
      : null;
  const removable = canRemoveParticipant(invite, viewer, participant);

  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <PlayerAvatar name={name} highlight={isMe} className="size-9" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate font-semibold', isMe && 'text-primary')}>
          {isMe ? 'You' : name}
        </span>
        <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          {participant.isCreator ? <span>Creator</span> : null}
          {addedBy ? (
            <span>
              Added by{' '}
              {participant.representativeLeaguePlayerId === viewer
                ? 'you'
                : addedBy}
            </span>
          ) : null}
        </span>
      </div>
      {removable ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-label={`Remove ${name}`}
          onClick={() => onRemove(participant.leaguePlayerId)}
        >
          <X aria-hidden="true" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Remove</span>
        </Button>
      ) : null}
    </li>
  );
}

function AddPlayers({
  invite,
  leaguePlayers,
  spotsLeft,
  pending,
  onAdd,
}: {
  invite: GameInviteResponse;
  leaguePlayers: LeaguePlayerResponse[];
  spotsLeft: number;
  pending: boolean;
  onAdd: (leaguePlayerIds: string[]) => void;
}) {
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const inInvite = useMemo(
    () => new Set(invite.participants.map((p) => p.leaguePlayerId)),
    [invite.participants]
  );
  const candidates = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return leaguePlayers.filter(
      (p) =>
        !inInvite.has(p.id) &&
        (needle === '' ||
          (p.displayName ?? '').toLowerCase().includes(needle) ||
          (p.username ?? '').toLowerCase().includes(needle))
    );
  }, [leaguePlayers, inInvite, filter]);

  // A concurrent signup can put a selected player in the roster before Add is clicked.
  const availableSelection = selected.filter((id) => !inInvite.has(id));

  const tooMany = availableSelection.length > spotsLeft;
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );

  return (
    <section
      aria-labelledby="add-players-heading"
      className="flex flex-col gap-3"
    >
      <h3 id="add-players-heading" className="text-sm font-semibold">
        Add league players
      </h3>
      <p className="text-xs text-muted-foreground">
        Added players take a spot straight away and don&apos;t need to open the
        link. You can accept or decline for them until they take control.
      </p>
      <Input
        type="search"
        aria-label="Search league players"
        placeholder="Search by name"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No players to add.</p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {candidates.map((player) => {
            const isSelected = selected.includes(player.id);
            const name = getPlayerDisplayName(player);
            return (
              <li key={player.id}>
                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={isSelected}
                  onClick={() => toggle(player.id)}
                  className={cn(
                    'h-auto w-full justify-start gap-3 px-3 py-2 text-start hover:border-primary',
                    isSelected && 'border-primary bg-primary/10'
                  )}
                >
                  <PlayerAvatar
                    name={name}
                    highlight={isSelected}
                    className="size-8 text-xs"
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {name}
                  </span>
                  {isSelected ? (
                    <Check aria-hidden="true" className="size-4 text-primary" />
                  ) : null}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {tooMany ? (
        <p role="alert" className="text-sm text-destructive">
          Only {spotsLeft} {spotsLeft === 1 ? 'spot is' : 'spots are'} left.
          Deselect {availableSelection.length - spotsLeft} to add them together.
        </p>
      ) : null}
      <Button
        type="button"
        disabled={pending || availableSelection.length === 0 || tooMany}
        onClick={() => {
          onAdd(availableSelection);
          setSelected([]);
        }}
      >
        {availableSelection.length > 0
          ? `Add ${availableSelection.length} ${availableSelection.length === 1 ? 'player' : 'players'}`
          : 'Add players'}
      </Button>
    </section>
  );
}

function AcceptanceView({
  invite,
  viewer,
  now,
  pending,
  onRespond,
  onCancel,
}: {
  invite: GameInviteResponse;
  viewer: string;
  now: number;
  pending: boolean;
  onRespond: (leaguePlayerId: string, accept: boolean) => void;
  onCancel: () => void;
}) {
  const creator = isCreator(invite, viewer);
  const secondsLeft = secondsUntil(invite.acceptanceExpiresAt, now);
  const respondable = invite.participants.filter((p) =>
    canRespond(invite, viewer, p)
  );
  const awaiting = invite.participants.filter(
    (p) => p.acceptanceStatus === AcceptanceStatus.Pending
  ).length;
  const teamSize = invite.capacity / 2;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-bold text-primary">Accept the match</p>
        <p className="text-sm">
          <span className="tabular-nums">{secondsLeft}</span>s to accept. Teams
          are drawn and everyone has {ACCEPTANCE_WINDOW_SECONDS} seconds.
        </p>
        {secondsLeft === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Checking the responses...
          </p>
        ) : null}
      </div>

      {invite.teams.length > 0 ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2">
          {invite.teams.map((team, idx) => (
            <div key={team.index} className="contents">
              {idx > 0 ? (
                <span className="self-center text-xs text-muted-foreground">
                  vs
                </span>
              ) : null}
              <div className="flex min-w-0 flex-col gap-2 rounded-lg border p-3">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Team {team.index + 1} · {teamSize} per side
                </p>
                {team.players.map((player) => {
                  const participant = findParticipant(
                    invite,
                    player.leaguePlayerId
                  );
                  return (
                    <div
                      key={player.leaguePlayerId}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate font-semibold">
                        {player.leaguePlayerId === viewer
                          ? 'You'
                          : getPlayerDisplayName(player)}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {participant?.acceptanceStatus ===
                        AcceptanceStatus.Accepted
                          ? 'Accepted'
                          : participant?.acceptanceStatus ===
                              AcceptanceStatus.Declined
                            ? 'Declined'
                            : 'Waiting'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {respondable.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {respondable.map((player) => {
            const name =
              player.leaguePlayerId === viewer
                ? 'you'
                : getPlayerDisplayName(player);
            return (
              <li
                key={player.leaguePlayerId}
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <span className="text-sm font-semibold sm:flex-1">
                  {player.leaguePlayerId === viewer
                    ? 'Your spot'
                    : `For ${name}`}
                </span>
                <div className="grid grid-cols-2 gap-2 sm:w-72">
                  <Button
                    type="button"
                    className="font-bold"
                    disabled={pending || secondsLeft === 0}
                    aria-label={`Accept for ${name}`}
                    onClick={() => onRespond(player.leaguePlayerId, true)}
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || secondsLeft === 0}
                    aria-label={`Decline for ${name}`}
                    onClick={() => onRespond(player.leaguePlayerId, false)}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {awaiting > 0
            ? `Waiting for ${awaiting} more ${awaiting === 1 ? 'response' : 'responses'}.`
            : 'All responses are in.'}
        </p>
      )}

      {creator ? (
        <div className="flex flex-col gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel invite
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function LeaveDialog({
  open,
  managedNames,
  pending,
  onOpenChange,
  onLeaveAlone,
  onLeaveTogether,
}: {
  open: boolean;
  managedNames: string[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onLeaveAlone: () => void;
  onLeaveTogether: () => void;
}) {
  const count = managedNames.length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogTitle>Leave this game invite?</DialogTitle>
        <DialogDescription>
          You added {managedNames.join(', ')}. Leave them in the invite and the
          creator will manage them from now on, or remove them too.
        </DialogDescription>
        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button type="button" disabled={pending} onClick={onLeaveTogether}>
            Leave and remove {count === 1 ? 'them' : `all ${count}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onLeaveAlone}
          >
            Leave and keep them in the invite
          </Button>
          <DialogClose render={<Button type="button" variant="ghost" />}>
            Stay in the invite
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
