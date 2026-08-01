import { clientChart } from './client-chart';
import type { SparklineProps } from './sparkline.impl';
import type { LineChartProps } from './line-chart.impl';
import type { HeatmapProps } from './heatmap.impl';

export type { SparklineProps, LineChartProps, HeatmapProps };

/**
 * All three wrappers are client-only and code-split — `@carbon/charts-react`
 * needs the DOM and must not be evaluated during SSR, and its stylesheet rides
 * along in the same chunk (see carbon-charts.tsx).
 *
 * The `.bx--chart-holder` / `.cds--chart-holder` wrapper element that e2e
 * locates comes from Carbon itself and is unaffected by this indirection.
 */
export const Sparkline = clientChart<SparklineProps>(
  () => import('./sparkline.impl')
);

export const LineChart = clientChart<LineChartProps>(
  () => import('./line-chart.impl')
);

export const Heatmap = clientChart<HeatmapProps>(
  () => import('./heatmap.impl')
);
