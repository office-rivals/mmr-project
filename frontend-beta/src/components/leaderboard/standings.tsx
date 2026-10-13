import { useState } from 'react';
import { Crown } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Sparkline } from '@/components/charts';
import { Eyebrow } from '@/components/eyebrow';
import { PlayerAvatar } from '@/components/player-avatar';
import { Button } from '@/components/ui/button';
import { useHydrated } from '@/hooks/use-hydrated';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { RANKED_MATCH_THRESHOLD, SHOW_STREAK_THRESHOLD } from '@/lib/constants';
import { winRate, type Result, type WeekChange } from '@/lib/player-stats';
import { cn, getPlayerDisplayName } from '@/lib/utils';
import type {
  LeaderboardEntryResponse,
  LeagueRatingHistoryEntry,
} from '@/api-v3';

type Entry = LeaderboardEntryResponse;

const handle = (e: Entry) => e.username ?? e.displayName ?? 'Unknown';
const pct = (v: number) => `${Math.round(v * 100)}%`;

function StreakIcon({ entry }: { entry: Entry }) {
  if (entry.winningStreak >= SHOW_STREAK_THRESHOLD)
    return (
      <span title={`${entry.winningStreak} wins in a row`} className="text-xs">
        🔥
      </span>
    );
  if (entry.losingStreak >= SHOW_STREAK_THRESHOLD)
    return (
      <span title={`${entry.losingStreak} losses in a row`} className="text-xs">
        {entry.losingStreak >= 7 ? '⛈️' : '🌧️'}
      </span>
    );
  return null;
}

function useMmr() {
  const { formatNumber } = useLocaleFormatters();
  return (v: number | null) =>
    v == null ? '—' : formatNumber(v, { maximumFractionDigits: 0 });
}

interface PodiumProps {
  top: Entry[];
  me: string | null;
  playerHref: (id: string) => string;
}

/** Top three, with first place raised in the middle. */
export function Podium({ top, me, playerHref }: PodiumProps) {
  const mmr = useMmr();
  if (top.length < 3) return null;
  const [first, second, third] = top;
  const lead = first.mmr ?? 0;

  const card = (entry: Entry, place: 1 | 2 | 3) => {
    const isMe = entry.leaguePlayerId === me;
    const gap = lead - (entry.mmr ?? 0);
    return (
      <li
        key={entry.leaguePlayerId}
        className={cn(
          'flex flex-col gap-3 rounded-lg border p-4 lg:p-5',
          place === 1
            ? 'order-2 border-primary/50 bg-gradient-to-b from-primary/15 to-primary/5 lg:pb-6'
            : 'mt-6 bg-card lg:mt-10',
          place === 2 && 'order-1',
          place === 3 && 'order-3'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'flex items-start gap-1 text-4xl leading-none font-bold lg:text-6xl',
              place === 1 ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {entry.rank}
            {place === 1 ? (
              <Crown aria-hidden="true" className="size-4 lg:size-6" />
            ) : null}
          </span>
          <PlayerAvatar
            name={getPlayerDisplayName(entry)}
            highlight={place === 1 || isMe}
            className={cn(
              'hidden lg:flex',
              place === 1 ? 'size-16 text-base' : 'size-12 text-sm'
            )}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <AppLink
            to={playerHref(entry.leaguePlayerId)}
            className={cn(
              'flex min-w-0 items-center gap-1 truncate text-base font-bold hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:text-xl',
              isMe && 'text-primary'
            )}
          >
            <span className="truncate">{handle(entry)}</span>
            <StreakIcon entry={entry} />
          </AppLink>
          <span className="truncate text-xs text-muted-foreground">
            <span className="hidden lg:inline">
              {entry.displayName ? `${entry.displayName} · ` : null}
            </span>
            {entry.wins}–{entry.losses}
            <span className="hidden lg:inline"> · {pct(winRate(entry))}</span>
          </span>
        </div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2">
          <span
            className={cn(
              'leading-none font-bold tabular-nums',
              place === 1 ? 'text-2xl lg:text-4xl' : 'text-xl lg:text-3xl'
            )}
          >
            {mmr(entry.mmr)}
          </span>
          {place !== 1 && gap > 0 ? (
            <span className="hidden text-xs text-muted-foreground lg:inline">
              {mmr(gap)} behind #1
            </span>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <ol
      aria-label="Top three"
      className="grid grid-cols-3 items-start gap-2 lg:gap-4"
    >
      {card(first, 1)}
      {card(second, 2)}
      {card(third, 3)}
    </ol>
  );
}

export function YourPositionCard({
  ranked,
  me,
}: {
  ranked: Entry[];
  me: Entry;
}) {
  const mmr = useMmr();
  const index = ranked.findIndex((e) => e.leaguePlayerId === me.leaguePlayerId);
  const above = index > 0 ? ranked[index - 1] : null;
  const below = index >= 0 ? (ranked[index + 1] ?? null) : null;

  let progress: number | null = null;
  if (me.mmr != null && above?.mmr != null && below?.mmr != null) {
    const span = above.mmr - below.mmr;
    progress = span > 0 ? (me.mmr - below.mmr) / span : 0.5;
  }

  return (
    <section
      aria-label="Your position"
      className="flex flex-col gap-3 rounded-lg border border-primary/50 bg-gradient-to-br from-primary/15 to-primary/5 p-4 lg:p-5"
    >
      <Eyebrow className="hidden lg:block">Your position</Eyebrow>
      <div className="flex items-center gap-4">
        <span className="text-4xl leading-none font-bold text-primary lg:text-6xl">
          {me.mmr != null ? `#${me.rank}` : '—'}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 lg:hidden">
          <span className="font-bold text-primary">You</span>
          <span className="truncate text-xs text-muted-foreground">
            {[
              above?.mmr != null && me.mmr != null
                ? `${mmr(above.mmr - me.mmr)} behind ${handle(above)}`
                : null,
              below?.mmr != null && me.mmr != null
                ? `${mmr(me.mmr - below.mmr)} ahead of ${handle(below)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Play ranked matches to place'}
          </span>
        </div>
        <span className="ml-auto text-2xl font-bold tabular-nums lg:hidden">
          {mmr(me.mmr)}
        </span>
      </div>
      {progress != null && above && below ? (
        <div className="hidden flex-col gap-2 lg:flex">
          <div
            className="relative h-1.5 rounded-full bg-muted"
            aria-hidden="true"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              style={{ width: `${progress * 100}%` }}
            />
            <div
              className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-foreground"
              style={{ left: `${progress * 100}%` }}
            />
          </div>
          <div className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {mmr(me.mmr! - below.mmr!)} ahead of {handle(below)}
            </span>
            <span>
              {mmr(above.mmr! - me.mmr!)} behind {handle(above)}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function StreaksCard({
  entries,
  me,
}: {
  entries: Entry[];
  me: string | null;
}) {
  const streaks = entries
    .map((e) => ({
      entry: e,
      win: e.winningStreak >= SHOW_STREAK_THRESHOLD,
      length: Math.max(e.winningStreak, e.losingStreak),
    }))
    .filter((s) => s.length >= SHOW_STREAK_THRESHOLD)
    .sort((a, b) => Number(b.win) - Number(a.win) || b.length - a.length)
    .slice(0, 5);
  if (streaks.length === 0) return null;

  return (
    <section
      aria-labelledby="streaks-heading"
      className="rounded-lg border bg-card"
    >
      <h2 id="streaks-heading" className="border-b px-5 py-4 text-xl">
        Streaks
      </h2>
      <ul>
        {streaks.map(({ entry, win, length }) => (
          <li
            key={entry.leaguePlayerId}
            className={cn(
              'flex items-center gap-3 border-b px-5 py-3 text-sm last:border-b-0',
              entry.leaguePlayerId === me && 'text-primary'
            )}
          >
            <span className="flex-1 truncate">{handle(entry)}</span>
            <span aria-hidden="true">{win ? '🔥' : '🌧️'}</span>
            <span className="w-8 text-right font-bold">
              {win ? 'W' : 'L'}
              {length}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FormSquares({ form }: { form: Result[] | undefined }) {
  const results = form ?? [];
  const wins = results.filter((r) => r === 'W').length;
  return (
    <span
      role="img"
      aria-label={
        results.length
          ? `Last ${results.length}: ${wins} wins, ${results.length - wins} losses`
          : 'No recent matches'
      }
      className="flex gap-0.5"
    >
      {Array.from({ length: 5 }, (_, i) => results[i]).map((r, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            'size-3 rounded-[2px]',
            r === 'W'
              ? 'bg-primary'
              : r === 'L'
                ? 'border border-muted-foreground/50'
                : 'bg-muted/50'
          )}
        />
      ))}
    </span>
  );
}

export type StandingsMetric = 'mmr' | 'winrate' | 'form' | 'week';

interface StandingsTableProps {
  entries: Entry[];
  me: string | null;
  form: Map<string, Result[]>;
  ratingHistory: LeagueRatingHistoryEntry[] | undefined;
  playerHref: (id: string) => string;
  /** The sort in effect; its column stays visible on phones. */
  metric?: StandingsMetric;
  /** Rating change this week, shown in its own column for the week sort. */
  week?: Map<string, WeekChange>;
  /** Rows shown before "Show all". */
  initialRows?: number;
}

function WeekDelta({ change }: { change: WeekChange | undefined }) {
  if (!change || change.games === 0) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">No matches this week</span>
      </span>
    );
  }
  const games = `${change.games} ${change.games === 1 ? 'match' : 'matches'}`;
  if (change.delta == null) {
    return <span className="text-muted-foreground">{games}</span>;
  }
  return (
    <span className="flex flex-col items-end leading-tight">
      <span
        className={cn(
          'font-bold',
          change.delta > 0 && 'text-green-400',
          change.delta < 0 && 'text-red-400'
        )}
      >
        {change.delta > 0 ? '+' : change.delta < 0 ? '−' : ''}
        {Math.abs(change.delta)}
      </span>
      <span className="text-[10px] text-muted-foreground">{games}</span>
    </span>
  );
}

export function StandingsTable({
  entries,
  me,
  form,
  ratingHistory,
  playerHref,
  metric = 'mmr',
  week,
  initialRows = 12,
}: StandingsTableProps) {
  // On phones the sort's own column replaces the trend sparkline.
  const formOnPhone = metric === 'form';
  const trendOnPhone = metric !== 'form' && metric !== 'week';
  const mmr = useMmr();
  const hydrated = useHydrated();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? entries : entries.slice(0, initialRows);
  const head =
    'h-10 px-2 text-left align-middle text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground';
  const cell = 'px-2 py-2.5 align-middle';

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr>
            <th scope="col" className={cn(head, 'w-12 pl-4')}>
              #
            </th>
            <th scope="col" className={head}>
              Player
            </th>
            <th
              scope="col"
              className={cn(head, 'hidden text-right lg:table-cell')}
            >
              W
            </th>
            <th
              scope="col"
              className={cn(head, 'hidden text-right lg:table-cell')}
            >
              L
            </th>
            <th
              scope="col"
              className={cn(head, 'hidden text-right xl:table-cell')}
            >
              Win %
            </th>
            <th
              scope="col"
              className={cn(
                head,
                'pl-4',
                formOnPhone ? 'table-cell' : 'hidden lg:table-cell'
              )}
            >
              Last 5
            </th>
            <th
              scope="col"
              className={cn(head, !trendOnPhone && 'hidden lg:table-cell')}
            >
              Trend
            </th>
            {metric === 'week' ? (
              <th scope="col" className={cn(head, 'text-right')}>
                This week
              </th>
            ) : null}
            <th scope="col" className={cn(head, 'pr-4 text-right')}>
              MMR
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((entry) => {
            const isMe = entry.leaguePlayerId === me;
            const history = ratingHistory
              ?.filter((h) => h.leaguePlayerId === entry.leaguePlayerId)
              .map((h) => ({ date: h.playedAt, rating: h.mmr }));
            return (
              <tr
                key={entry.leaguePlayerId}
                aria-current={isMe ? 'true' : undefined}
                className={cn(
                  'border-b last:border-b-0',
                  isMe && 'bg-primary/10 text-primary'
                )}
              >
                <td
                  className={cn(cell, 'pl-4 text-base font-bold tabular-nums')}
                >
                  {entry.rank}
                </td>
                <td className={cell}>
                  <div className="flex items-center gap-3">
                    <PlayerAvatar
                      name={getPlayerDisplayName(entry)}
                      highlight={isMe}
                    />
                    <div className="flex min-w-0 flex-col leading-tight">
                      <AppLink
                        to={playerHref(entry.leaguePlayerId)}
                        className="flex items-center gap-1 truncate font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <span className="truncate">{handle(entry)}</span>
                        <StreakIcon entry={entry} />
                      </AppLink>
                      <span
                        className={cn(
                          'truncate text-xs',
                          !isMe && 'text-muted-foreground'
                        )}
                      >
                        <span className="lg:hidden">
                          {entry.wins}–{entry.losses} · {pct(winRate(entry))}
                        </span>
                        <span className="hidden lg:inline">
                          {entry.displayName ?? ''}
                        </span>
                      </span>
                    </div>
                  </div>
                </td>
                <td
                  className={cn(
                    cell,
                    'hidden text-right tabular-nums lg:table-cell'
                  )}
                >
                  {entry.wins}
                </td>
                <td
                  className={cn(
                    cell,
                    'hidden text-right tabular-nums lg:table-cell'
                  )}
                >
                  {entry.losses}
                </td>
                <td
                  className={cn(
                    cell,
                    'hidden text-right tabular-nums xl:table-cell'
                  )}
                >
                  {pct(winRate(entry))}
                </td>
                <td
                  className={cn(
                    cell,
                    'pl-4',
                    formOnPhone ? 'table-cell' : 'hidden lg:table-cell'
                  )}
                >
                  <FormSquares form={form.get(entry.leaguePlayerId)} />
                </td>
                <td
                  className={cn(cell, !trendOnPhone && 'hidden lg:table-cell')}
                >
                  <div className="pointer-events-none w-12 sm:w-16">
                    {history ? <Sparkline data={history} /> : null}
                  </div>
                </td>
                {metric === 'week' ? (
                  <td className={cn(cell, 'text-right tabular-nums')}>
                    <WeekDelta change={week?.get(entry.leaguePlayerId)} />
                  </td>
                ) : null}
                <td
                  className={cn(
                    cell,
                    'pr-4 text-right text-base font-bold tabular-nums'
                  )}
                >
                  {mmr(entry.mmr)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {entries.length > initialRows ? (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            Showing {visible.length} of {entries.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hydrated}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Show fewer' : `Show all ${entries.length}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function UnrankedList({
  entries,
  playerHref,
}: {
  entries: Entry[];
  playerHref: (id: string) => string;
}) {
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="unranked-heading" className="flex flex-col gap-3">
      <h2
        id="unranked-heading"
        className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase"
      >
        Unranked · play {RANKED_MATCH_THRESHOLD} matches to place
      </h2>
      <ul className="overflow-hidden rounded-lg border bg-card">
        {entries.map((entry) => {
          const played = entry.wins + entry.losses;
          return (
            <li
              key={entry.leaguePlayerId}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <PlayerAvatar name={getPlayerDisplayName(entry)} dashed />
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <AppLink
                  to={playerHref(entry.leaguePlayerId)}
                  className="truncate font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {handle(entry)}
                </AppLink>
                <span className="text-xs text-muted-foreground">
                  {Math.min(played, RANKED_MATCH_THRESHOLD)} of{' '}
                  {RANKED_MATCH_THRESHOLD} placement matches
                </span>
              </div>
              <span aria-hidden="true">🐣</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
