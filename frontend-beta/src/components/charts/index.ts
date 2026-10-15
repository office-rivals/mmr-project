import { clientChart } from './client-chart';
import type { LineChartProps } from './line-chart.impl';
import type { HeatmapProps } from './heatmap.impl';

export type { LineChartProps, HeatmapProps };

export const LineChart = clientChart<LineChartProps>(
  () => import('./line-chart.impl')
);

export const Heatmap = clientChart<HeatmapProps>(
  () => import('./heatmap.impl')
);
export { TrendLine } from './trend-line';
export { RatingChart, RatingChartLegend } from './rating-chart';
