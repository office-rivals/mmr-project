import { AppLink } from '@/components/app-link';
import { RatingTrend } from '@/components/charts/rating-trend';
import { Eyebrow } from '@/components/eyebrow';
import { FormChips } from '@/components/form-chips';
import { featuredCard, plainCard, StatusPill } from '@/components/surfaces';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import {
  partnerWinRate,
  shareBeaten,
  streakLabel,
  topPercent,
  winRate,
  type PartnerRecord,
  type Result,
} from '@/lib/player-stats';
import { cn, getPlayerDisplayName } from '@/lib/utils';
import type { ActiveMatchResponse, LeaderboardEntryResponse } from '@/api-v3';

export interface HomeStanding {
  entry: LeaderboardEntryResponse;
  /** Ranked players only, in leaderboard order. */
  ranked: LeaderboardEntryResponse[];
  form: Result[];
  /** `undefined` while the rating history is still streaming. */
  weekDelta: number | null | undefined;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) return null;
  return (
    <span
      className={cn(
        'text-xs font-semibold',
        value > 0 ? 'text-green-400' : 'text-red-400'
      )}
    >
      {value > 0 ? '+' : '−'}
      {Math.abs(Math.round(value))}
      {suffix}
    </span>
  );
}

/** Rank, MMR, win rate and form in one card, for phones. */
export function HomeHeroCompact({ standing }: { standing: HomeStanding }) {
  const { formatNumber } = useLocaleFormatters();
  const { entry, ranked, form, weekDelta } = standing;
  const isRanked = entry.mmr != null;
  const streak = streakLabel(entry);

  return (
    <div className={cn(featuredCard, 'flex flex-col gap-3 p-4 lg:hidden')}>
      <dl className="grid grid-cols-3 divide-x divide-primary/20">
        <div className="flex flex-col gap-1 pr-3">
          <dt className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Rank
          </dt>
          <dd className="text-2xl leading-none font-bold text-primary">
            {isRanked ? (
              <>
                #{entry.rank}
                <span className="text-xs font-normal text-muted-foreground">
                  {' '}
                  / {ranked.length}
                </span>
              </>
            ) : (
              <span className="text-base">Unranked</span>
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1 px-3">
          <dt className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            MMR
          </dt>
          <dd className="flex items-baseline gap-1 text-2xl leading-none font-bold">
            {entry.mmr != null
              ? formatNumber(entry.mmr, { maximumFractionDigits: 0 })
              : '—'}
            {weekDelta ? <Delta value={weekDelta} /> : null}
          </dd>
        </div>
        <div className="flex flex-col gap-1 pl-3">
          <dt className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Win rate
          </dt>
          <dd className="flex items-baseline gap-1 text-2xl leading-none font-bold">
            {pct(winRate(entry))}
            <span className="text-xs font-normal text-muted-foreground">
              {entry.wins}–{entry.losses}
            </span>
          </dd>
        </div>
      </dl>
      {form.length > 0 ? (
        <div className="flex items-center gap-3 border-t border-primary/20 pt-3">
          <Eyebrow>Form</Eyebrow>
          <FormChips form={form} className="flex-1" />
          {streak ? (
            <span
              className={cn(
                'text-sm font-bold',
                streak.startsWith('W')
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {streak}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The large rank card with the gap to the neighbouring ranks. */
export function HomeRankCard({ standing }: { standing: HomeStanding }) {
  const { formatNumber } = useLocaleFormatters();
  const { entry, ranked, form, weekDelta } = standing;
  const fmt = (v: number) => formatNumber(v, { maximumFractionDigits: 0 });
  const index = ranked.findIndex(
    (e) => e.leaguePlayerId === entry.leaguePlayerId
  );
  const above = index > 0 ? ranked[index - 1] : null;
  const below = index >= 0 ? (ranked[index + 1] ?? null) : null;
  const wins = form.filter((r) => r === 'W').length;
  const topShare = index >= 0 ? topPercent(entry.rank, ranked.length) : null;

  let progress: number | null = null;
  if (entry.mmr != null && above?.mmr != null && below?.mmr != null) {
    const span = above.mmr - below.mmr;
    progress = span > 0 ? (entry.mmr - below.mmr) / span : 0.5;
  }

  return (
    <div className={cn(featuredCard, 'flex flex-col gap-6 p-6')}>
      <div className="flex items-start justify-between gap-4">
        <Eyebrow>League rank</Eyebrow>
        {topShare != null ? <StatusPill>Top {topShare}%</StatusPill> : null}
      </div>
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <p className="flex items-baseline gap-2">
          {entry.mmr != null ? (
            <>
              <span className="text-7xl leading-none font-bold tracking-tight text-primary xl:text-8xl">
                #{entry.rank}
              </span>
              <span className="text-lg text-muted-foreground">
                of {ranked.length}
              </span>
            </>
          ) : (
            <span className="text-4xl font-bold text-primary">Unranked</span>
          )}
        </p>
        <div className="flex flex-col gap-1">
          <Eyebrow>MMR</Eyebrow>
          <p className="text-4xl leading-none font-bold">
            {entry.mmr != null ? fmt(entry.mmr) : '—'}
          </p>
          {weekDelta ? (
            <p>
              <Delta value={weekDelta} suffix=" this week" />
            </p>
          ) : null}
        </div>
        {form.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Eyebrow>
              Form · last {form.length} · {wins}–{form.length - wins}
            </Eyebrow>
            <FormChips form={form} />
          </div>
        ) : null}
      </div>
      {progress != null && above && below && entry.mmr != null ? (
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              Chasing{' '}
              <span className="font-semibold text-foreground">
                #{above.rank} {getPlayerDisplayName(above)}
              </span>
            </span>
            <span className="font-semibold">
              {fmt(above.mmr! - entry.mmr)} MMR to go ·{' '}
              {fmt(entry.mmr - below.mmr!)} ahead of #{below.rank}
            </span>
          </div>
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
          <div className="flex justify-between text-muted-foreground">
            <span>
              #{below.rank} {getPlayerDisplayName(below)} · {fmt(below.mmr!)}
            </span>
            <span>
              #{above.rank} {getPlayerDisplayName(above)} · {fmt(above.mmr!)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div className={cn(plainCard, 'flex flex-col gap-2 p-5')}>
      <Eyebrow>{label}</Eyebrow>
      <p className="text-4xl leading-none font-bold text-primary">{value}</p>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export function HomeKpiTiles({
  standing,
  matchesThisWeek,
  peak,
}: {
  standing: HomeStanding;
  /** `null` when "this week" does not apply, e.g. for a past season. */
  matchesThisWeek: number | null;
  /** `undefined` while the rating history is still streaming. */
  peak: { mmr: number } | null | undefined;
}) {
  const { formatNumber } = useLocaleFormatters();
  const { entry, ranked } = standing;
  const leagueAvg =
    ranked.length > 0
      ? ranked.reduce((sum, e) => sum + winRate(e), 0) / ranked.length
      : null;
  const streak = streakLabel(entry);

  return (
    <div className="grid grid-cols-2 gap-4">
      <Tile
        label="Win rate"
        value={pct(winRate(entry))}
        note={leagueAvg != null ? `League avg ${pct(leagueAvg)}` : undefined}
      />
      <Tile
        label="Streak"
        value={
          streak ? (
            <span className={cn(streak.startsWith('L') && 'text-foreground')}>
              {streak}
              {entry.winningStreak >= 3 ? ' 🔥' : null}
            </span>
          ) : (
            '—'
          )
        }
        note={
          entry.winningStreak > 0
            ? 'Wins in a row'
            : entry.losingStreak > 0
              ? 'Losses in a row'
              : undefined
        }
      />
      <Tile
        label="Matches"
        value={entry.wins + entry.losses}
        note={`${entry.wins} W · ${entry.losses} L${matchesThisWeek != null ? ` · ${matchesThisWeek} this week` : ''}`}
      />
      <Tile
        label="Peak MMR"
        value={
          peak ? formatNumber(peak.mmr, { maximumFractionDigits: 0 }) : '—'
        }
        note="This season"
      />
    </div>
  );
}

// Card titles below label regions rather than act as headings: the page's
// heading outline is reserved for its recent-matches and leaderboard sections.
export function RatingCard({
  points,
}: {
  points: { mmr: number; playedAt: string }[] | undefined;
}) {
  return (
    <section
      aria-labelledby="home-rating-heading"
      className={cn(plainCard, 'flex flex-col gap-4 p-6')}
    >
      <div className="flex items-center justify-between">
        <p id="home-rating-heading" className="text-2xl">
          Your rating
        </p>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden="true" className="h-0.5 w-3 bg-primary" />
          You
        </span>
      </div>
      {points ? (
        <RatingTrend points={points} label="Your rating this season" />
      ) : (
        <div className="h-[200px] animate-pulse rounded-md bg-muted/40 motion-reduce:animate-none" />
      )}
    </section>
  );
}

export function LeagueStandingCard({ standing }: { standing: HomeStanding }) {
  const { formatNumber } = useLocaleFormatters();
  const { entry, ranked } = standing;
  const others = ranked.filter(
    (e) => e.leaguePlayerId !== entry.leaguePlayerId
  );
  if (entry.mmr == null || others.length === 0) return null;

  const played = (e: LeaderboardEntryResponse) => e.wins + e.losses;
  const rows = [
    {
      label: 'MMR',
      value: formatNumber(entry.mmr, { maximumFractionDigits: 0 }),
      share: shareBeaten(
        entry.mmr,
        others.map((e) => e.mmr ?? 0)
      ),
    },
    {
      label: 'Win rate',
      value: pct(winRate(entry)),
      share: shareBeaten(winRate(entry), others.map(winRate)),
    },
    {
      label: 'Matches played',
      value: String(played(entry)),
      share: shareBeaten(played(entry), others.map(played)),
    },
  ];

  return (
    <section
      aria-labelledby="home-standing-heading"
      className={cn(plainCard, 'flex flex-col gap-5 p-6')}
    >
      <div className="flex flex-col gap-1">
        <p id="home-standing-heading" className="text-2xl">
          You vs the league
        </p>
        <p className="text-xs text-muted-foreground">
          Share of the other {others.length} ranked players you beat · tick =
          middle of the league
        </p>
      </div>
      <ul className="flex flex-col gap-4">
        {rows.map((row) => (
          <li key={row.label} className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span>
                {row.label} · <span className="font-bold">{row.value}</span>
              </span>
              <span className="text-xs font-semibold text-primary">
                Beats {pct(row.share)}
              </span>
            </div>
            <div
              className="relative h-1.5 rounded-full bg-muted"
              aria-hidden="true"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: pct(row.share) }}
              />
              <div className="absolute -top-1 left-1/2 h-3.5 w-0.5 bg-foreground" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PartnerCards({
  duo,
  nemesis,
  profileBase,
}: {
  duo: PartnerRecord | null;
  nemesis: PartnerRecord | null;
  profileBase: string;
}) {
  return (
    <>
      {duo ? (
        <AppLink
          to={`${profileBase}/${duo.leaguePlayerId}`}
          className={cn(
            plainCard,
            'flex flex-col gap-2 p-5 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
          )}
        >
          <Eyebrow>Best duo</Eyebrow>
          <span className="truncate text-xl font-bold">
            You + {getPlayerDisplayName(duo)}
          </span>
          <span className="flex justify-between text-xs text-muted-foreground">
            <span>
              {duo.wins}–{duo.losses} together
            </span>
            <span className="font-semibold text-primary">
              {pct(partnerWinRate(duo))} wins
            </span>
          </span>
        </AppLink>
      ) : null}
      {nemesis ? (
        <AppLink
          to={`${profileBase}/${nemesis.leaguePlayerId}`}
          className={cn(
            featuredCard,
            'flex flex-col gap-2 p-5 transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
          )}
        >
          <Eyebrow className="text-primary">Nemesis</Eyebrow>
          <span className="truncate text-xl font-bold">
            {getPlayerDisplayName(nemesis)}
          </span>
          <span className="text-xs text-muted-foreground">
            {nemesis.wins}–{nemesis.losses} against
          </span>
        </AppLink>
      ) : null}
    </>
  );
}

export function LiveNowCard({
  match,
  now,
  href,
}: {
  match: ActiveMatchResponse;
  now: number;
  href: string;
}) {
  const minutes = Math.max(
    0,
    Math.floor((now - Date.parse(match.startedAt)) / 60_000)
  );
  const [a, b] = [...match.teams].sort((x, y) => x.index - y.index);
  const names = (team: typeof a | undefined) =>
    (team?.players ?? []).map((p) => getPlayerDisplayName(p)).join(' + ');

  return (
    <AppLink
      to={href}
      className={cn(
        plainCard,
        'flex flex-col gap-2 border-green-500/40 p-5 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
      )}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-green-400 uppercase">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-green-400 motion-safe:animate-pulse"
        />
        Live now · {minutes} min
      </span>
      <span className="truncate text-xl font-bold">
        {names(a)}{' '}
        <span className="text-xs font-normal text-muted-foreground">vs</span>{' '}
        {names(b)}
      </span>
      <span className="text-xs text-muted-foreground">Open the live match</span>
    </AppLink>
  );
}
