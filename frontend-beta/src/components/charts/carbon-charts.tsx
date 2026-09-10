// Carbon requires the browser DOM; load this module through clientChart.
import '@carbon/charts-react/styles.css';

export {
  AreaChart,
  LineChart as CarbonLineChart,
  HeatmapChart,
  ScaleTypes,
} from '@carbon/charts-react';
export type {
  AreaChartOptions,
  LineChartOptions,
  HeatmapChartOptions,
} from '@carbon/charts-react';
