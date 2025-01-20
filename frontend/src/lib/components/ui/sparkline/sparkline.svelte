<script lang="ts">
  import {
    AreaChart,
    ScaleTypes,
    type AreaChartOptions,
  } from '@carbon/charts-svelte';

  export let data: Array<{ date: Date; rating: number }>;
  export let options: Partial<AreaChartOptions> = {};

  const chartOptions: AreaChartOptions = {
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
  };
</script>

{#if data.length > 1}
  <AreaChart {data} options={chartOptions} />
{/if}
