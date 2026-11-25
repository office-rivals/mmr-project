import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { WEEK_MS, matchOutcome } from '@/lib/player-stats';
import { cn, getPlayerDisplayName } from '@/lib/utils';
import type { MatchResponse } from '@/api-v3';

const DAY_MS = 24 * 60 * 60 * 1000;
const dtClass =
  'text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground';

interface SummaryProps {
  matches: MatchResponse[];
  me: string;
  now: number;
  showMmr: boolean;
}

function useWeek({ matches, me, now }: Omit<SummaryProps, 'showMmr'>) {
  const recent = matches
    .filter((m) => Date.parse(m.playedAt) >= now - WEEK_MS)
    .map((m) => ({ match: m, outcome: matchOutcome(m, me) }))
    .filter((r) => r.outcome != null);
  const wins = recent.filter((r) => r.outcome!.won).length;
  const mmr = recent.reduce((sum, r) => sum + (r.outcome!.delta ?? 0), 0);
  return { recent, wins, losses: recent.length - wins, mmr };
}

function signed(value: number) {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}`;
}

/** Played, record and MMR change over the last seven days, in one row. */
export function WeekSummaryCompact(props: SummaryProps) {
  const { recent, wins, losses, mmr } = useWeek(props);
  return (
    <dl className="grid grid-cols-3 divide-x rounded-lg border bg-card p-4 lg:hidden">
      <div className="flex flex-col gap-1 pr-3">
        <dt className={dtClass}>This week</dt>
        <dd className="text-lg font-bold">{recent.length} played</dd>
      </div>
      <div className="flex flex-col items-center gap-1 px-3">
        <dt className={dtClass}>Record</dt>
        <dd className="text-lg font-bold">
          {wins}–{losses}
        </dd>
      </div>
      <div className="flex flex-col items-end gap-1 pl-3">
        <dt className={dtClass}>MMR</dt>
        <dd
          className={cn(
            'text-lg font-bold',
            props.showMmr && mmr > 0 && 'text-green-400',
            props.showMmr && mmr < 0 && 'text-red-400'
          )}
        >
          {props.showMmr ? signed(mmr) : '—'}
        </dd>
      </div>
    </dl>
  );
}

/** The weekly summary with a per-day bar of wins and losses. */
export function WeekSummaryCard(props: SummaryProps) {
  const { formatDate } = useLocaleFormatters();
  const { recent, wins, losses, mmr } = useWeek(props);
  const dayKey = (value: string | number) =>
    formatDate(new Date(value).toISOString(), '', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  const days = Array.from({ length: 7 }, (_, i) => {
    const at = props.now - (6 - i) * DAY_MS;
    const key = dayKey(at);
    const results = recent.filter((r) => dayKey(r.match.playedAt) === key);
    return {
      key,
      label: formatDate(new Date(at).toISOString(), '', { weekday: 'narrow' }),
      wins: results.filter((r) => r.outcome!.won).length,
      losses: results.filter((r) => !r.outcome!.won).length,
    };
  });
  const tallest = Math.max(1, ...days.map((d) => d.wins + d.losses));

  return (
    <section
      aria-labelledby="week-summary-heading"
      className="flex flex-col gap-5 rounded-lg border bg-card p-5"
    >
      <h2 id="week-summary-heading" className="text-xl">
        This week
      </h2>
      <dl className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <dt className={dtClass}>Played</dt>
          <dd className="text-2xl font-bold">{recent.length}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className={dtClass}>Record</dt>
          <dd className="text-2xl font-bold">
            {wins}–{losses}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className={dtClass}>MMR</dt>
          <dd
            className={cn(
              'text-2xl font-bold',
              props.showMmr && mmr > 0 && 'text-green-400',
              props.showMmr && mmr < 0 && 'text-red-400'
            )}
          >
            {props.showMmr ? signed(mmr) : '—'}
          </dd>
        </div>
      </dl>
      <ol
        aria-label="Results per day"
        className="grid h-28 grid-cols-7 items-end gap-1.5"
      >
        {days.map((day, i) => (
          <li key={day.key} className="flex h-full flex-col items-center gap-2">
            <span className="flex w-full flex-1 flex-col-reverse gap-0.5">
              {day.wins + day.losses === 0 ? (
                <span className="h-0.5 w-full bg-muted" />
              ) : (
                <>
                  {Array.from({ length: day.wins }, (_, j) => (
                    <span
                      key={`w${j}`}
                      className="w-full rounded-[2px] bg-primary"
                      style={{ height: `${70 / tallest}%` }}
                    />
                  ))}
                  {Array.from({ length: day.losses }, (_, j) => (
                    <span
                      key={`l${j}`}
                      className="w-full rounded-[2px] border border-muted-foreground/60"
                      style={{ height: `${70 / tallest}%` }}
                    />
                  ))}
                </>
              )}
            </span>
            <span
              className={cn(
                'text-[10px] text-muted-foreground',
                i === 6 && 'font-bold text-primary'
              )}
            >
              <span aria-hidden="true">{day.label}</span>
              <span className="sr-only">
                {`${day.wins} wins, ${day.losses} losses`}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-[2px] bg-primary"
          />
          Win
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-[2px] border border-muted-foreground/60"
          />
          Loss
        </span>
      </p>
    </section>
  );
}

/** The viewer's largest rating changes among the loaded matches. */
export function BiggestSwings({
  matches,
  me,
  now,
}: Omit<SummaryProps, 'showMmr'>) {
  const { formatMatchDay } = useLocaleFormatters();
  const swings = matches
    .map((m) => ({ match: m, outcome: matchOutcome(m, me) }))
    .filter((r) => r.outcome?.delta != null)
    .sort((a, b) => Math.abs(b.outcome!.delta!) - Math.abs(a.outcome!.delta!))
    .slice(0, 3);
  if (swings.length === 0) return null;

  return (
    <section
      aria-labelledby="swings-heading"
      className="rounded-lg border bg-card"
    >
      <h2 id="swings-heading" className="border-b px-5 py-4 text-xl">
        Biggest swings
      </h2>
      <ul>
        {swings.map(({ match, outcome }) => (
          <li
            key={match.id}
            className="flex items-center gap-3 border-b px-5 py-3 last:border-b-0"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm">
                vs{' '}
                {outcome!.otherTeam.players
                  .map((p) => p.username ?? getPlayerDisplayName(p))
                  .join(' + ')}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatMatchDay(match.playedAt, now)} · {outcome!.myTeam.score}–
                {outcome!.otherTeam.score}
              </span>
            </span>
            <span
              className={cn(
                'font-bold tabular-nums',
                outcome!.delta! >= 0 ? 'text-green-400' : 'text-red-400'
              )}
            >
              {signed(outcome!.delta!)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
