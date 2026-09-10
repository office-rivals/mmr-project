import { useMemo } from 'react';
import { AreaChart, ScaleTypes, type AreaChartOptions } from './carbon-charts';

export interface SparklineProps {
  data: Array<{ date: Date | string; rating: number }>;
  options?: Partial<AreaChartOptions>;
}

export default function SparklineImpl({ data, options = {} }: SparklineProps) {
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
      getStrokeColor: () => 'hsl(var(--primary) / 1)',
      toolbar: { enabled: false },
      tooltip: { enabled: false },
      animations: false,
      ...options,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init-once by design
    []
  );

  if (data.length <= 1) return null;

  return <AreaChart data={data} options={chartOptions} />;
}
