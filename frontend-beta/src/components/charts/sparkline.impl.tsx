import { useMemo } from 'react';
import { AreaChart, ScaleTypes, type AreaChartOptions } from './carbon-charts';

export interface SparklineProps {
  data: Array<{ date: Date | string; rating: number }>;
  options?: Partial<AreaChartOptions>;
}

export default function SparklineImpl({ data, options = {} }: SparklineProps) {
  // Computed once, exactly like the Svelte `const` — changing `options` after
  // mount does not reconfigure the chart, and a fresh object every render
  // would thrash Carbon.
  const chartOptions = useMemo<AreaChartOptions>(
    () => ({
      theme: 'g100',
      curve: 'curveMonotoneX',
      height: `20px`,
      data: {
        loading: false,
        ...(options.data ?? {}),
      },
      legend: { enabled: false },
      grid: {
        x: { enabled: false },
        y: { enabled: false },
      },
      axes: {
        ...(options.axes ?? {}),
        left: {
          visible: false,
          mapsTo: 'rating',
          scaleType: ScaleTypes.LINEAR,
          includeZero: false,
          ...(options.axes?.left ?? {}),
        },
        bottom: {
          visible: false,
          mapsTo: 'date',
          scaleType: ScaleTypes.TIME,
          ...(options.axes?.bottom ?? {}),
        },
      },
      color: {
        gradient: { enabled: true },
      },
      // The literal `var()` string is handed to Carbon, which sets it as an
      // inline style, so it resolves against the themed variable.
      getStrokeColor: () => 'hsl(var(--primary) / 1)',
      toolbar: { enabled: false },
      tooltip: { enabled: false },
      animations: false,
      ...options,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init-once by design
    []
  );

  // ⚠️ Quirk preserved from the Svelte original: with 0 or 1 points nothing is
  // rendered at all — which also swallows the intended `loading: true` state,
  // since the leaderboard's loading branch passes `data={[]}`. Do not "fix"
  // this without deciding it deliberately; it is a visible behaviour change.
  if (data.length <= 1) return null;

  return <AreaChart data={data} options={chartOptions} />;
}
