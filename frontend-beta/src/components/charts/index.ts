import { clientChart } from './client-chart';
import type { SparklineProps } from './sparkline.impl';
import type { LineChartProps } from './line-chart.impl';
import type { HeatmapProps } from './heatmap.impl';

export type { SparklineProps, LineChartProps, HeatmapProps };

export const Sparkline = clientChart<SparklineProps>(
  () => import('./sparkline.impl')
);

export const LineChart = clientChart<LineChartProps>(
  () => import('./line-chart.impl')
);

export const Heatmap = clientChart<HeatmapProps>(
  () => import('./heatmap.impl')
);
