import { useId } from 'react';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { peakRating } from '@/lib/player-stats';

interface RatingPoint {
  mmr: number;
  playedAt: string;
}

interface RatingTrendProps {
  /** Oldest first. */
  points: RatingPoint[];
  height?: number;
  label: string;
}

const WIDTH = 600;

/**
 * Plain SVG area chart for one player's rating. Server-renderable, so it needs
 * no client-only chart bundle on the home page.
 */
export function RatingTrend({ points, height = 200, label }: RatingTrendProps) {
  const gradientId = useId();
  const { formatDate, formatNumber } = useLocaleFormatters();

  if (points.length < 2) {
    return (
      <p
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Not enough matches yet
      </p>
    );
  }

  const values = points.map((p) => p.mmr);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(10, (max - min) * 0.1);
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (i / (points.length - 1)) * WIDTH;
  const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;

  const line = points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.mmr).toFixed(1)}`
    )
    .join(' ');
  const area = `${line} L${WIDTH},${height} L0,${height} Z`;
  const peak = peakRating(points)!;
  const last = points[points.length - 1];
  const fmt = (v: number) => formatNumber(v, { maximumFractionDigits: 0 });
  const day = (d: string) =>
    formatDate(d, '—', { month: 'short', day: 'numeric' });

  return (
    <figure className="flex flex-col gap-2">
      <svg
        role="img"
        aria-label={`${label}: from ${fmt(points[0].mmr)} to ${fmt(last.mmr)}, peak ${fmt(peak.mmr)}`}
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        className="w-full overflow-visible"
        style={{ height }}
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
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={WIDTH}
            y1={height * f}
            y2={height * f}
            className="stroke-border"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          className="stroke-primary"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span>{day(points[0].playedAt)}</span>
        <span>
          Peak {fmt(peak.mmr)} · {day(peak.playedAt)}
        </span>
        <span>Now · {fmt(last.mmr)}</span>
      </figcaption>
    </figure>
  );
}
