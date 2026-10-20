import { Fragment, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  createFileRoute,
  getRouteApi,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Check } from 'lucide-react';
import { HttpErrorView } from '@/components/http-error-view';
import { PageTitle } from '@/components/page-title';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LastSeen } from '@/features/foosball/last-seen';
import {
  columns,
  deviceTroubleLines,
  endLabel,
  lastGoalText,
  liveChange,
  nameOf,
  scoreOf,
  statusLine,
  undoneText,
  winner,
} from '@/features/foosball/live';
import { OccupancyBadge } from '@/features/foosball/occupancy';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { failServerAction } from '@/lib/server/action-result';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { HttpError } from '@/lib/http-error';
import { cn } from '@/lib/utils';
import type {
  LiveTableResponse,
  TableEnd,
  TablePlayerResponse,
} from '@/features/foosball/api';

const leagueRoute = getRouteApi('/_authed/$orgSlug/$leagueSlug');

type Ids = { orgId: string; leagueId: string; tableId: string };

// A short hold, so a dead connection shows as "Reconnecting…" within 10 s.
const LONG_POLL_WAIT_S = 5;
const STALE_AFTER_MS = 10_000;
const UNDONE_SHOWN_MS = 4_000;

const loadTableFn = createServerFn({ method: 'GET' })
  .validator((ids: Ids) => ids)
  .handler(async ({ data: { orgId, leagueId, tableId } }) => {
    const { foosballApi, activeMatchesApi } = await requireApiClientV3();
    const [live, claimable, activeMatches] = await Promise.all([
      foosballApi.getLive(orgId, tableId),
      foosballApi.listClaimable(orgId, tableId),
      activeMatchesApi.listActiveMatches(orgId, leagueId),
    ]);
    return { live, claimable, activeMatches };
  });

/** Long-poll: answers when the version moves past `since`, or after the wait. */
const liveFn = createServerFn({ method: 'GET' })
  .validator((input: Ids & { since?: number }) => input)
  .handler(async ({ data }): Promise<LiveTableResponse> =>
    (await requireApiClientV3()).foosballApi.getLive(
      data.orgId,
      data.tableId,
      data.since,
      LONG_POLL_WAIT_S
    )
  );

const claimableFn = createServerFn({ method: 'GET' })
  .validator((ids: Ids) => ids)
  .handler(async ({ data }) =>
    (await requireApiClientV3()).foosballApi.listClaimable(
      data.orgId,
      data.tableId
    )
  );

const newGameFn = createServerFn({ method: 'POST' })
  .validator((input: Ids & { save: boolean; expectedVersion: number }) => input)
  .handler(
    async ({ data }): Promise<{ live?: LiveTableResponse; error?: string }> => {
      const { foosballApi } = await requireApiClientV3();
      try {
        return {
          live: await foosballApi.newGame(
            data.orgId,
            data.tableId,
            data.save,
            data.expectedVersion
          ),
        };
      } catch (err) {
        // Our copy only: the API's text never reaches the page.
        const { status } = await getApiErrorDetails(err, '');
        return failServerAction(status, {
          error:
            status === 409
              ? 'The score changed, check it and try again.'
              : 'That didn’t work. Please try again.',
        });
      }
    }
  );

const linkFn = createServerFn({ method: 'POST' })
  .validator((input: Ids & { activeMatchId: string }) => input)
  .handler(async ({ data }): Promise<{ error?: string }> => {
    const { foosballApi } = await requireApiClientV3();
    try {
      await foosballApi.linkActiveMatch(
        data.orgId,
        data.leagueId,
        data.activeMatchId,
        data.tableId
      );
      return {};
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to link the match'
      );
      return failServerAction(status, { error: message });
    }
  });

export const Route = createFileRoute(
  '/_authed/$orgSlug/$leagueSlug/tables/$tableId'
)({
  loader: async ({ context, params }) => {
    const { league } = context;
    const data = await loadTableFn({
      data: {
        orgId: league.orgId,
        leagueId: league.leagueId,
        tableId: params.tableId,
      },
    });
    // A table belongs to one league: show it (and its claim and link) there.
    const tableLeague = data.live.table.leagueId;
    if (tableLeague !== league.leagueId) {
      const slug = context.authedShell.organizations
        .find((o) => o.id === league.orgId)
        ?.leagues?.find((l) => l.id === tableLeague)?.slug;
      if (!slug)
        throw new HttpError(
          404,
          'This table belongs to a league you’re not in'
        );
      throw redirect({
        to: '/$orgSlug/$leagueSlug/tables/$tableId',
        params: { ...params, leagueSlug: slug },
      });
    }
    return data;
  },
  errorComponent: HttpErrorView,
  component: TablePage,
});

const names = (players: TablePlayerResponse[]) =>
  players.map(nameOf).join(' & ');

/** A name with the player's scan-in colour, as the scoreboard's LEDs show it. */
function PlayerName({ player }: { player: TablePlayerResponse }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {player.colorHex && (
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full"
          style={{ backgroundColor: player.colorHex }}
        />
      )}
      {nameOf(player)}
    </span>
  );
}

/** One pulse on a goal; a colour flash when motion is reduced. */
function pulse(el: HTMLElement | null | undefined) {
  if (!el?.animate) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.animate(
    reduce
      ? [{ color: 'var(--color-primary)' }, {}]
      : [
          { transform: 'scale(1)' },
          { transform: 'scale(1.15)' },
          { transform: 'scale(1)' },
        ],
    { duration: 400, easing: 'ease-out' }
  );
}

/** A short fade on both digits after an undo, no pulse. */
function fade(els: (HTMLElement | null | undefined)[]) {
  for (const el of els)
    el?.animate?.([{ opacity: 0.3 }, { opacity: 1 }], { duration: 300 });
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Keeps the screen on while `on`; browsers without it just don't. */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    // The browser drops the lock when the tab is hidden; take it back.
    const acquire = () => {
      if (document.visibilityState !== 'visible' || lock?.released === false)
        return;
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (done) void l.release();
          else lock = l;
        })
        .catch(() => {});
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', acquire);
      lock?.release().catch(() => {});
    };
  }, [on]);
}

function TablePage() {
  const league = leagueRoute.useLoaderData();
  const data = Route.useLoaderData();
  const { tableId } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { formatTime } = useLocaleFormatters();
  const ids = { orgId: league.orgId, leagueId: league.leagueId, tableId };
  const [error, setError] = useState<string | null>(null);
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const [undone, setUndone] = useState<{ text: string; until: number }>();
  const now = useNow();

  const liveKey = ['foosball-live', tableId];
  // The interval only starts the next long-poll: a held one isn't repeated.
  const liveQuery = useQuery({
    queryKey: liveKey,
    queryFn: () =>
      liveFn({
        data: {
          ...ids,
          since: queryClient.getQueryData<LiveTableResponse>(liveKey)?.version,
        },
      }),
    initialData: data.live,
    refetchInterval: 1000,
    retry: false,
  });
  const live = liveQuery.data;
  const { table, match, roster } = live;
  const stale = now - liveQuery.dataUpdatedAt > STALE_AFTER_MS;

  const claimable = useQuery({
    queryKey: ['foosball-claimable', tableId, live.version],
    queryFn: () => claimableFn({ data: ids }),
    initialData:
      live.version === data.live.version ? data.claimable : undefined,
    placeholderData: (previous) => previous,
    staleTime: Infinity,
  }).data;

  const ends = columns(table);
  const label = (end: TableEnd) => endLabel(table, end);
  const teamPlayers = (end: TableEnd) =>
    (end === 'A' ? match?.playersA : match?.playersB) ?? [];
  const hasBoard = table.hasScoreboard;
  const won = winner(match);
  const winningScore =
    !match?.leagueId || match.leagueId === league.leagueId
      ? league.leagueWinningScore
      : null;
  useWakeLock(match?.status === 'Live');

  // Pulse the scoring column; say so when a goal was undone. Only a new
  // answer (version) can change the score.
  const digits = useRef<Partial<Record<TableEnd, HTMLElement | null>>>({});
  const previous = useRef(match);
  useEffect(() => {
    const change = liveChange(previous.current, match);
    previous.current = match;
    if (change?.type === 'goal') pulse(digits.current[change.end]);
    if (change?.type === 'undo' && match) {
      fade([digits.current.A, digits.current.B]);
      setUndone({
        text: undoneText(table, change.end, match),
        until: Date.now() + UNDONE_SHOWN_MS,
      });
    }
  }, [live.version]);

  const newGame = useMutation({
    mutationFn: (save: boolean) =>
      newGameFn({ data: { ...ids, save, expectedVersion: live.version } }),
    onSuccess: (result) => {
      setConfirmNewGame(false);
      setError(result.error ?? null);
      if (result.live) queryClient.setQueryData(liveKey, result.live);
    },
    onError: () => setError('That didn’t work. Please try again.'),
  });

  const link = useMutation({
    mutationFn: (activeMatchId: string) =>
      linkFn({ data: { ...ids, activeMatchId } }),
    onSuccess: async (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      await router.invalidate();
    },
    onError: () => setError('Failed to link the match'),
  });

  const goalLine = lastGoalText(table, match, now, formatTime);
  const trouble = deviceTroubleLines(table, live.devices, now);

  return (
    <div className="flex flex-col gap-8">
      <PageTitle>{table.name}</PageTitle>
      <div className="-mt-6 flex items-center justify-center gap-3">
        <OccupancyBadge table={table} />
        <Link
          to="/$orgSlug/$leagueSlug/tables/$tableId/stats"
          params={{
            orgSlug: league.orgSlug,
            leagueSlug: league.leagueSlug,
            tableId,
          }}
          className="text-sm underline underline-offset-4"
        >
          Stats
        </Link>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}

      <section aria-label="Live score" className="flex flex-col gap-3">
        <div
          className={cn(
            'grid grid-cols-[1fr_auto_1fr] items-start text-center transition-opacity',
            // A stale score must never look live.
            stale && 'opacity-40'
          )}
        >
          {ends.map((end, i) => (
            <Fragment key={end}>
              {i === 1 && (
                <div className="pt-10 text-4xl text-muted-foreground">:</div>
              )}
              <div className="flex min-w-0 flex-col items-center gap-1">
                {/* The team's name, or its players once they're known. */}
                <div className="flex max-w-full items-center gap-1 text-lg font-medium">
                  <span className="truncate">
                    {teamPlayers(end).length > 0
                      ? names(teamPlayers(end))
                      : label(end)}
                  </span>
                  {won === end && (
                    <Check
                      className="size-5 shrink-0 text-primary"
                      aria-label="Won"
                    />
                  )}
                </div>
                <div
                  ref={(el) => {
                    digits.current[end] = el;
                  }}
                  className={cn(
                    'text-8xl leading-none font-bold tabular-nums',
                    !match && 'text-muted-foreground'
                  )}
                >
                  {match ? scoreOf(match, end) : '–'}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
        <p
          className="text-center text-sm"
          aria-live="polite"
          suppressHydrationWarning
        >
          {stale
            ? 'Reconnecting…'
            : undone && now < undone.until
              ? undone.text
              : statusLine(table, match, winningScore, now)}
        </p>
        {goalLine && (
          <p
            className="text-center text-sm text-muted-foreground"
            suppressHydrationWarning
          >
            {goalLine}
          </p>
        )}
      </section>

      {match?.status === 'Live' && match.scoreA + match.scoreB > 0 && (
        <Button
          variant="ghost"
          disabled={newGame.isPending || stale}
          onClick={() => setConfirmNewGame(true)}
        >
          New game
        </Button>
      )}

      <Dialog open={confirmNewGame} onOpenChange={setConfirmNewGame}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New game</DialogTitle>
            <DialogDescription>
              Keep this game so it can be rated, or throw it away.
            </DialogDescription>
          </DialogHeader>
          {match && (
            <DialogFooter className="gap-2">
              <Button
                disabled={newGame.isPending}
                onClick={() => newGame.mutate(true)}
              >
                Save {ends.map((end) => scoreOf(match, end)).join(' : ')}
              </Button>
              <Button
                variant="destructive"
                disabled={newGame.isPending}
                onClick={() => newGame.mutate(false)}
              >
                Throw it away
              </Button>
              <Button variant="ghost" onClick={() => setConfirmNewGame(false)}>
                Cancel
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {roster && roster.players.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-2xl">
            At the table{' '}
            <span className="text-base text-muted-foreground">
              {roster.players.length}/{roster.teamSize * 2}
            </span>
          </h2>
          <ul className="flex flex-col gap-1">
            {roster.players.map((p) => (
              <li key={p.leaguePlayerId}>
                <PlayerName player={p} />
              </li>
            ))}
          </ul>
          {hasBoard && (
            <p className="text-sm text-muted-foreground">
              {roster.canGenerate
                ? 'Everyone is in. Make teams on the scoreboard.'
                : 'Tap your badge on the scoreboard to join.'}
            </p>
          )}
        </section>
      )}

      {claimable && claimable.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-2xl">Who played?</h2>
          {claimable.map((m) => (
            <Button key={m.id} variant="outline" asChild>
              <Link
                to="/$orgSlug/$leagueSlug/submit"
                params={{
                  orgSlug: league.orgSlug,
                  leagueSlug: league.leagueSlug,
                }}
                search={{ table: tableId, match: m.id }}
              >
                {ends
                  .map((end) => `${label(end)} ${scoreOf(m, end)}`)
                  .join(' – ')}
                <span className="ml-2 opacity-70">
                  <LastSeen at={m.endedAt ?? m.startedAt} />
                </span>
              </Link>
            </Button>
          ))}
        </section>
      )}

      {!match?.activeMatchId && data.activeMatches.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-2xl">Playing a matchmade game here?</h2>
          {data.activeMatches.map((m) => (
            <Button
              key={m.id}
              variant="outline"
              // Long names wrap instead of running off the button.
              className="h-auto py-2 whitespace-normal"
              disabled={link.isPending}
              onClick={() => link.mutate(m.id)}
            >
              {m.teams.map((t) => names(t.players)).join(' vs ')}
            </Button>
          ))}
        </section>
      )}

      {trouble.length > 0 && (
        <ul className="text-center text-sm text-muted-foreground">
          {trouble.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
