import { useId } from 'react';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { peakRating } from '@/lib/player-stats';
import { cn } from '@/lib/utils';

interface RatingPoint {
  mmr: number;
  playedAt: string;
}

interface RatingChartProps {
  /** Oldest first. */
  points: RatingPoint[];
  /** Names the chart for screen readers. */
  label: string;
  /** Labels the last point "Now"; a past season names its date instead. */
  current: boolean;
}

// viewBox units; the SVG stretches to its box, and the HTML labels and markers
// are placed by percentage so they stay crisp at any size.
const WIDTH = 600;
const HEIGHT = 200;
const STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
const X_LABELS = 4;

/** Round-number gridlines inside `[lo, hi]`, at most five of them. */
export function ratingTicks(lo: number, hi: number): number[] {
  const step = STEPS.find((s) => (hi - lo) / s <= 4) ?? STEPS[STEPS.length - 1];
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  return ticks;
}

const pct = (value: number, of: number) => `${(value / of) * 100}%`;

/**
 * One player's rating across time, with a rating axis, date labels and the
 * peak ringed. Plain SVG, so it renders on the server like the rest of the
 * page.
 */
export function RatingChart({ points, label, current }: RatingChartProps) {
  const gradientId = useId();
  const { formatDate, formatNumber } = useLocaleFormatters();

  if (points.length < 2) {
    return (
      <p className="flex h-44 items-center justify-center text-sm text-muted-foreground lg:h-60">
        Not enough matches yet
      </p>
    );
  }

  const times = points.map((p) => Date.parse(p.playedAt));
  const first = times[0];
  const span = times[times.length - 1] - first;
  // Spaced by time, so a quiet week reads as a long flat stretch; matches that
  // all share one timestamp fall back to even spacing.
  const x = (i: number) =>
    span > 0
      ? ((times[i] - first) / span) * WIDTH
      : (i / (points.length - 1)) * WIDTH;

  const values = points.map((p) => p.mmr);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(10, (max - min) * 0.12);
  const lo = min - pad;
  const hi = max + pad;
  const y = (v: number) => HEIGHT - ((v - lo) / (hi - lo)) * HEIGHT;

  const line = points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.mmr).toFixed(1)}`
    )
    .join(' ');
  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

  const peak = peakRating(points)!;
  const peakIndex = points.indexOf(peak);
  const last = points[points.length - 1];
  const fmt = (v: number) => formatNumber(v, { maximumFractionDigits: 0 });
  const day = (at: number | string) =>
    formatDate(new Date(at).toISOString(), '—', {
      month: 'short',
      day: 'numeric',
    });

  // Evenly spaced dates, the last of which is the latest rating.
  const xLabels = Array.from({ length: X_LABELS }, (_, i) => {
    const fraction = i / (X_LABELS - 1);
    if (i === X_LABELS - 1) {
      return {
        fraction,
        text: `${current ? 'Now' : day(times[times.length - 1])} · ${fmt(last.mmr)}`,
      };
    }
    return {
      fraction,
      text: span > 0 ? day(first + span * fraction) : '',
    };
  });

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex h-44 gap-3 lg:h-60">
        <div
          aria-hidden="true"
          className="relative w-9 shrink-0 text-[10px] text-muted-foreground tabular-nums"
        >
          {ratingTicks(lo, hi).map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: pct(y(tick), HEIGHT) }}
            >
              {fmt(tick)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <svg
            role="img"
            aria-label={`${label}: from ${fmt(points[0].mmr)} to ${fmt(last.mmr)}, peak ${fmt(peak.mmr)} on ${day(peak.playedAt)}`}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="block size-full overflow-visible"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            {ratingTicks(lo, hi).map((tick) => (
              <line
                key={tick}
                x1="0"
                x2={WIDTH}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-border"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={area} fill={`url(#${gradientId})`} />
            <path
              data-testid="rating-line"
              d={line}
              fill="none"
              className="stroke-primary"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            aria-hidden="true"
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background"
            style={{
              left: pct(x(peakIndex), WIDTH),
              top: pct(y(peak.mmr), HEIGHT),
            }}
          />
          {peakIndex !== points.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
              style={{ left: '100%', top: pct(y(last.mmr), HEIGHT) }}
            />
          ) : null}
        </div>
      </div>
      <figcaption
        aria-hidden="true"
        className="relative ml-12 h-4 text-[10px] whitespace-nowrap text-muted-foreground"
      >
        {xLabels.map(({ fraction, text }) => (
          <span
            key={fraction}
            className={cn(
              'absolute top-0',
              fraction === 0
                ? 'translate-x-0'
                : fraction === 1
                  ? '-translate-x-full'
                  : '-translate-x-1/2'
            )}
            style={{ left: pct(fraction, 1) }}
          >
            {text}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** The key for {@link RatingChart}: the player's line and the peak ring. */
export function RatingChartLegend({ className }: { className?: string }) {
  return (
    <p
      aria-hidden="true"
      className={cn(
        'flex items-center gap-3 text-xs text-muted-foreground',
        className
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-3 rounded-full bg-primary" />
        You
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full border-2 border-primary" />
        Peak
      </span>
    </p>
  );
}
