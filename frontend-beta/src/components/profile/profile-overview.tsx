import type { ReactNode } from 'react';
import { Flame, TrendingUp, Trophy } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Eyebrow } from '@/components/eyebrow';
import { PlayerAvatar } from '@/components/player-avatar';
import { useHydrated } from '@/hooks/use-hydrated';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { cn, getPlayerDisplayName } from '@/lib/utils';
import type { OpponentEntry, PlayerProfileStats } from '@/lib/server/profile';
import { topPercent, type ProfileRecords } from '@/lib/player-stats';
import type { MatchResponse } from '@/api-v3';

const card = 'rounded-lg border bg-card';
const dtClass =
  'text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase';
const DAY_MS = 24 * 60 * 60 * 1000;

const shortDate: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
};

function signed(value: number) {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}`;
}

interface ProfileHeaderProps {
  name: string;
  username: string | null;
  isCurrentUser: boolean;
  matchesPlayed: number;
  stats: PlayerProfileStats;
  peak: { mmr: number; playedAt: string } | null;
  /** `null` when a weekly change does not apply, e.g. for a past season. */
  weekDelta: number | null;
  actions?: ReactNode;
  /** The page's `h1`, so the heading outline stays in the route. */
  title: ReactNode;
}

/**
 * Identity, then rank, rating and peak. On phones the numbers sit in their own
 * band below the name; from `lg` they share one warm card with it.
 */
export function ProfileHeader({
  name,
  username,
  isCurrentUser,
  matchesPlayed,
  stats,
  peak,
  weekDelta,
  actions,
  title,
}: ProfileHeaderProps) {
  const { formatNumber, formatDate } = useLocaleFormatters();
  const number = (v: number) => formatNumber(v, { maximumFractionDigits: 0 });
  const ranked = stats.rank != null && stats.rank > 0;
  const top = ranked ? topPercent(stats.rank!, stats.rankedCount) : null;

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8 lg:rounded-xl lg:border lg:border-primary/50 lg:bg-gradient-to-br lg:from-primary/15 lg:via-primary/5 lg:to-transparent lg:p-8">
      <div className="flex min-w-0 items-center gap-4 lg:gap-6">
        <PlayerAvatar
          name={name}
          highlight
          className="size-16 border-2 text-xl ring-4 ring-primary/15 lg:size-28 lg:text-4xl"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {title}
            {isCurrentUser ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tracking-[0.14em] uppercase">
                You
              </span>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {[
              username ? `@${username}` : null,
              `${matchesPlayed} ${matchesPlayed === 1 ? 'match' : 'matches'} this season`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {actions ? (
            <div className="mt-1 flex flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-primary/20 rounded-lg border border-primary/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 lg:gap-8 lg:divide-x-0 lg:border-0 lg:bg-none lg:p-0">
        <div className="flex flex-col gap-1 pr-3 lg:pr-0">
          <dt className={dtClass}>Rank</dt>
          <dd className="text-3xl leading-none font-bold text-primary lg:text-5xl">
            {ranked ? `#${stats.rank}` : '—'}
          </dd>
          {top != null ? (
            <dd className="text-xs text-muted-foreground">Top {top}%</dd>
          ) : !ranked ? (
            <dd className="text-xs text-muted-foreground">Unranked</dd>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 px-3 lg:px-0">
          <dt className={dtClass}>MMR</dt>
          <dd className="text-3xl leading-none font-bold lg:text-5xl">
            {stats.mmr != null ? number(stats.mmr) : '🐣'}
          </dd>
          {weekDelta ? (
            <dd
              className={cn(
                'text-xs font-semibold',
                weekDelta > 0 ? 'text-green-400' : 'text-red-400'
              )}
            >
              {signed(weekDelta)} this week
            </dd>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 pl-3 lg:pl-0">
          <dt className={dtClass}>Peak</dt>
          <dd className="text-3xl leading-none font-bold text-muted-foreground lg:text-5xl">
            {peak ? number(peak.mmr) : '—'}
          </dd>
          {peak ? (
            <dd className="text-xs text-muted-foreground">
              {formatDate(peak.playedAt, '', shortDate)}
            </dd>
          ) : null}
        </div>
      </dl>
    </div>
  );
}

function Tile({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={cn(card, 'flex flex-col gap-1.5 p-3 lg:p-4')}>
      <p className={dtClass}>{label}</p>
      <p
        className={cn(
          'leading-none font-bold',
          // Relative dates run longer than the numbers beside them.
          typeof value === 'string' && value.length > 5
            ? 'text-xl lg:text-2xl'
            : 'text-2xl lg:text-3xl',
          accent && 'text-primary'
        )}
      >
        {value}
      </p>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export function ProfileKpis({
  stats,
  records,
}: {
  stats: PlayerProfileStats;
  records: ProfileRecords;
}) {
  const { formatNumber, formatRelativeTime } = useLocaleFormatters();
  const perMatch = (v: number | null) =>
    v == null ? '—' : formatNumber(v, { maximumFractionDigits: 1 });
  const streak =
    stats.winningStreak > 0
      ? `W${stats.winningStreak}`
      : stats.losingStreak > 0
        ? `L${stats.losingStreak}`
        : null;

  return (
    <div className="grid grid-cols-3 gap-2 lg:gap-3">
      {/* The labels keep the reference app's wording. */}
      <Tile label="# Matches" value={stats.totalMatches} />
      <Tile label="# Wins" value={stats.wins} />
      <Tile label="# Losses" value={stats.lost} />
      <Tile
        label="Win rate"
        accent
        value={formatNumber(stats.winrate, {
          style: 'percent',
          maximumFractionDigits: 0,
        })}
      />
      <Tile
        label="Streak"
        accent={stats.winningStreak > 0}
        value={
          streak ? (
            <>
              {streak}
              {stats.winningStreak >= 3 ? ' 🔥' : null}
            </>
          ) : (
            '—'
          )
        }
      />
      <Tile
        label="Last match"
        value={
          stats.daysSinceLastMatch != null
            ? formatRelativeTime(stats.daysSinceLastMatch, 'day', {
                style: 'narrow',
                numeric: stats.daysSinceLastMatch !== 0 ? 'always' : 'auto',
              })
            : '—'
        }
      />
      <Tile
        label="Goals for"
        value={perMatch(records.goalsFor)}
        note="per match"
      />
      <Tile
        label="Against"
        value={perMatch(records.goalsAgainst)}
        note="per match"
      />
      <Tile label="Shutouts" value={records.shutouts} note="dealt" />
    </div>
  );
}

export function RecordsCard({
  records,
  bestDay,
  className,
}: {
  records: ProfileRecords;
  bestDay: { playedAt: string; delta: number } | null;
  className?: string;
}) {
  const { formatDate } = useLocaleFormatters();
  const rows: {
    icon: ReactNode;
    label: string;
    value: ReactNode;
    note: string;
  }[] = [];
  if (records.longestWinStreak) {
    rows.push({
      icon: <Flame />,
      label: 'Longest win streak',
      value: records.longestWinStreak.length,
      note: formatDate(
        records.longestWinStreak.lastMatch.playedAt,
        '',
        shortDate
      ),
    });
  }
  if (records.biggestWin) {
    rows.push({
      icon: <Trophy />,
      label: 'Biggest win',
      value: `${records.biggestWin.for}–${records.biggestWin.against}`,
      note: formatDate(records.biggestWin.match.playedAt, '', shortDate),
    });
  }
  if (bestDay) {
    rows.push({
      icon: <TrendingUp />,
      label: 'Best day',
      value: <span className="text-green-400">{signed(bestDay.delta)}</span>,
      note: formatDate(bestDay.playedAt, '', shortDate),
    });
  }
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="profile-records-heading"
      className={cn(card, className)}
    >
      <h2 id="profile-records-heading" className="border-b px-5 py-4 text-xl">
        Records
      </h2>
      <dl>
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_5rem] items-center gap-3 border-b px-5 py-3 text-sm last:border-b-0"
          >
            <span aria-hidden="true" className="text-primary [&_svg]:size-4">
              {row.icon}
            </span>
            <dt>{row.label}</dt>
            <dd className="font-bold tabular-nums">{row.value}</dd>
            <dd className="text-right text-xs text-muted-foreground">
              {row.note}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function rate(row: OpponentEntry) {
  return row.total > 0 ? row.wins / row.total : 0;
}

function RecordRows({
  rows,
  playerHref,
  tag,
}: {
  rows: OpponentEntry[];
  playerHref: (leaguePlayerId: string) => string;
  tag?: { id: string; label: string };
}) {
  return (
    <ul>
      {rows.map((row) => {
        const share = Math.round(rate(row) * 100);
        return (
          <li
            key={row.leaguePlayerId}
            className="grid grid-cols-[minmax(0,1fr)_auto_4rem_2.75rem] items-center gap-3 border-b px-5 py-3 text-sm last:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-2">
              <AppLink
                to={playerHref(row.leaguePlayerId)}
                className="truncate font-semibold hover:underline"
              >
                {getPlayerDisplayName(row)}
              </AppLink>
              {tag?.id === row.leaguePlayerId ? (
                <span className="shrink-0 rounded-full border border-primary/60 bg-primary/10 px-1.5 text-[10px] font-semibold tracking-wider text-primary uppercase">
                  {tag.label}
                </span>
              ) : null}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {row.wins}–{row.losses}
            </span>
            <span aria-hidden="true" className="h-1.5 rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${share}%` }}
              />
            </span>
            <span className="text-right font-bold tabular-nums">{share}%</span>
          </li>
        );
      })}
    </ul>
  );
}

// Fewer games than this says more about luck than about the pairing.
const MIN_PAIR_GAMES = 3;

export function TeammatesCard({
  rows,
  playerHref,
}: {
  rows: OpponentEntry[];
  playerHref: (leaguePlayerId: string) => string;
}) {
  const duo = [...rows]
    .filter((r) => r.total >= MIN_PAIR_GAMES)
    .sort((a, b) => rate(b) - rate(a))[0];
  return (
    <section
      aria-labelledby="profile-teammates-heading"
      className={cn(card, 'flex flex-col')}
    >
      <div className="flex flex-col gap-0.5 border-b px-5 py-4">
        <h2 id="profile-teammates-heading" className="text-xl">
          Teammates
        </h2>
        <p className="text-xs text-muted-foreground">
          Most common teammates · your record together
        </p>
      </div>
      <RecordRows
        rows={rows}
        playerHref={playerHref}
        tag={duo ? { id: duo.leaguePlayerId, label: 'Duo' } : undefined}
      />
    </section>
  );
}

export function RivalsCard({
  rows,
  playerHref,
}: {
  rows: OpponentEntry[];
  playerHref: (leaguePlayerId: string) => string;
}) {
  const eligible = [...rows]
    .filter((r) => r.total >= MIN_PAIR_GAMES)
    .sort((a, b) => rate(a) - rate(b));
  const nemesis = eligible[0];
  const favourite =
    eligible.length > 1 ? eligible[eligible.length - 1] : undefined;
  const callout = (
    row: OpponentEntry,
    label: string,
    tone: 'warm' | 'green'
  ) => (
    <AppLink
      to={playerHref(row.leaguePlayerId)}
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-lg border p-3 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        tone === 'warm'
          ? 'border-primary/50 bg-primary/10 hover:bg-primary/15'
          : 'border-green-500/40 bg-green-500/10 hover:bg-green-500/15'
      )}
    >
      <span
        className={cn(
          'text-[10px] font-semibold tracking-[0.14em] uppercase',
          tone === 'warm' ? 'text-primary' : 'text-green-400'
        )}
      >
        {label}
      </span>
      <span className="truncate text-lg font-bold">
        {getPlayerDisplayName(row)}
      </span>
      <span className="text-xs text-muted-foreground">
        {row.wins}–{row.losses} · {Math.round(rate(row) * 100)}%
      </span>
    </AppLink>
  );

  return (
    <section
      aria-labelledby="profile-rivals-heading"
      className={cn(card, 'flex flex-col')}
    >
      <div className="flex flex-col gap-0.5 border-b px-5 py-4">
        <h2 id="profile-rivals-heading" className="text-xl">
          Rivals
        </h2>
        <p className="text-xs text-muted-foreground">Most common opponents</p>
      </div>
      {nemesis && favourite && rate(favourite) > rate(nemesis) ? (
        <div className="grid grid-cols-2 gap-2 border-b p-4">
          {callout(nemesis, 'Nemesis', 'warm')}
          {callout(favourite, 'Favourite matchup', 'green')}
        </div>
      ) : null}
      <RecordRows rows={rows} playerHref={playerHref} />
    </section>
  );
}

const WEEKS = 26;
const PHONE_WEEKS = 12;
const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const LEVELS = [
  'bg-muted',
  'bg-primary/35',
  'bg-primary/65',
  'bg-primary',
] as const;

const mondayIndex = (date: Date) => (date.getDay() + 6) % 7;

/**
 * Matches per local day over recent weeks, Monday-first columns. Day buckets
 * depend on the viewer's time zone, so the cells fill in after hydration.
 */
export function ActivityCard({
  matches,
  now,
}: {
  matches: MatchResponse[];
  now: number;
}) {
  const hydrated = useHydrated();
  if (matches.length === 0) return null;

  const counts = new Map<string, number>();
  const byWeekday = Array.from({ length: 7 }, () => 0);
  if (hydrated) {
    for (const match of matches) {
      const date = new Date(match.playedAt);
      const key = date.toDateString();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      byWeekday[mondayIndex(date)] += 1;
    }
  }

  // UTC until hydration so the server and the first client render agree.
  const nowDate = new Date(now);
  const today = hydrated ? mondayIndex(nowDate) : (nowDate.getUTCDay() + 6) % 7;
  const start = now - ((WEEKS - 1) * 7 + today) * DAY_MS;
  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const at = start + (w * 7 + d) * DAY_MS;
      if (at > now) return null;
      return counts.get(new Date(at).toDateString()) ?? 0;
    })
  );
  const busiest = Math.max(1, ...counts.values());
  const level = (count: number) =>
    count === 0 ? 0 : Math.min(3, Math.ceil((count / busiest) * 3));
  const top = Math.max(...byWeekday);
  const favourite = top > 0 ? WEEKDAYS[byWeekday.indexOf(top)] : null;

  return (
    <section
      aria-labelledby="profile-activity-heading"
      className={cn(card, 'flex flex-col gap-4 p-5')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="profile-activity-heading" className="text-xl">
          Activity
        </h2>
        <p className="text-xs text-muted-foreground">
          <span className="lg:hidden">Last {PHONE_WEEKS} weeks</span>
          <span className="hidden lg:inline">Last {WEEKS} weeks</span>
          {favourite ? (
            <>
              {' · most active on '}
              <span className="font-semibold text-foreground">
                {favourite}s
              </span>
            </>
          ) : null}
        </p>
      </div>
      <div aria-hidden="true" className="flex gap-2">
        <div className="grid grid-rows-7 gap-1 text-[10px] leading-none text-muted-foreground">
          {WEEKDAYS.map((day, i) => (
            <span key={day} className="flex items-center">
              {i % 2 === 0 ? day.slice(0, 3) : ''}
            </span>
          ))}
        </div>
        <div className="grid flex-1 auto-cols-fr grid-flow-col gap-1">
          {weeks.map((days, w) => (
            <div
              key={w}
              className={cn(
                'grid grid-rows-7 gap-1',
                w < WEEKS - PHONE_WEEKS && 'hidden lg:grid'
              )}
            >
              {days.map((count, d) => (
                <span
                  key={d}
                  className={cn(
                    'aspect-square rounded-[3px] lg:aspect-auto lg:h-4',
                    count != null && LEVELS[level(count)]
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p
        aria-hidden="true"
        className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground"
      >
        Less
        {LEVELS.map((cls) => (
          <span key={cls} className={cn('size-2.5 rounded-[2px]', cls)} />
        ))}
        More
      </p>
    </section>
  );
}
