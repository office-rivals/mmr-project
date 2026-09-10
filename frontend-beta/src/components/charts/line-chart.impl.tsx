import { useMemo } from 'react';
import {
  CarbonLineChart,
  ScaleTypes,
  type LineChartOptions,
} from './carbon-charts';

export interface LineChartProps {
  // TODO: Make this component more generic, and not hardcoded to showing MMR stats
  data: Array<{
    player: string;
    date: Date | string;
    rating: number;
  }>;
  height: number;
  legend?: boolean;
}

export default function LineChartImpl({
  data,
  height,
  legend = true,
}: LineChartProps) {
  const options = useMemo<LineChartOptions>(
    () => ({
      theme: 'g100',
      curve: 'curveMonotoneX',
      height: `${height}px`,
      data: {
        groupMapsTo: 'player',
        loading: false,
      },
      legend: {
        enabled: legend,
      },
      axes: {
        left: {
          title: 'Rating',
          mapsTo: 'rating',
          scaleType: ScaleTypes.LINEAR,
          includeZero: false,
        },
        bottom: {
          title: 'Time',
          mapsTo: 'date',
          scaleType: ScaleTypes.TIME,
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init-once by design
    []
  );

  return <CarbonLineChart data={data} options={options} />;
}
