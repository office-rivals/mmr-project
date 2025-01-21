<script lang="ts">
  import {
    LineChart,
    ScaleTypes,
    type LineChartOptions,
  } from '@carbon/charts-svelte';

  // TODO: Make this component more generic, and not hardcoded to showing MMR stats

  export let data: Array<{
    player: string;
    date: Date | string;
    rating: number;
  }>;
  export let height: number;
  export let legend = true;

  const options: LineChartOptions = {
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
  };
</script>

<LineChart {data} {options} />
