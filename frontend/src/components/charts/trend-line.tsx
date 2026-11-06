import { cn } from '@/lib/utils';

const WIDTH = 64;
const HEIGHT = 20;
const PAD = 2;

/**
 * A row-sized rating line in plain SVG, so a table of them costs no chart
 * bundle and renders on the server. Decorative: the row states the rating.
 */
export function TrendLine({
  values,
  highlight = false,
  className,
}: {
  /** Oldest first. */
  values: number[];
  highlight?: boolean;
  className?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * WIDTH;
      const y = span
        ? HEIGHT - PAD - ((v - min) / span) * (HEIGHT - 2 * PAD)
        : HEIGHT / 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn('block h-5 w-full overflow-visible', className)}
    >
      <polyline
        points={points}
        fill="none"
        className={highlight ? 'stroke-primary' : 'stroke-muted-foreground'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
