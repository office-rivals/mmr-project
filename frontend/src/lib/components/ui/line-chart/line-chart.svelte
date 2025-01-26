<script lang="ts">
  import {
    LineChart,
    ScaleTypes,
    type LineChartOptions,
  } from '@carbon/charts-svelte';

  interface Props {
    // TODO: Make this component more generic, and not hardcoded to showing MMR stats
    data: Array<{
      player: string;
      date: Date | string;
      rating: number;
    }>;
    height: number;
    legend?: boolean;
  }

  let { data, height, legend = true }: Props = $props();

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
