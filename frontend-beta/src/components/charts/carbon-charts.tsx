/**
 * The single module that pulls in `@carbon/charts-react` and its stylesheet.
 *
 * Where the stylesheet lives, and why: the Svelte app imported
 * `@carbon/charts-svelte/styles.css` from `(authed)/+layout.svelte`, so it was
 * scoped to the authed subtree. Here it is imported alongside the chart
 * implementations instead. Every import of this module is dynamic (see
 * `client-chart.tsx`), so the CSS ships in the same lazily-loaded chunk as the
 * charts and is guaranteed to be present exactly when — and only when — a chart
 * renders. That is strictly safer than layout-scoping it: no chart can ever
 * render unstyled (`.bx--chart-holder` / `.cds--chart-holder` black-on-black),
 * and routes without charts still pay nothing.
 *
 * This module must never be imported statically: Carbon needs the DOM and
 * crashes during SSR.
 */
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
