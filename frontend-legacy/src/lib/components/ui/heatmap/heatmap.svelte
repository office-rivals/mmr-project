<script lang="ts">
  import {
    HeatmapChart,
    ScaleTypes,
    type AreaChartOptions,
    type HeatmapChartOptions,
  } from '@carbon/charts-svelte';

  interface Props {
    data: Array<{
      dayOfWeek: number;
      hourOfDay: number;
      count: number;
    }>;
  }

  let { data }: Props = $props();

  const hourOfDayFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    hour12: false,
  });
  const dayOfWeekFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
  });

  // Generate an array of day of week names starting from Monday
  const dayOfWeekLabels = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(1970, 0, 5 + i); // Jan 5, 1970 is a Monday
    return dayOfWeekFormatter.format(date);
  });
  const hourOfDayLabels = Array.from({ length: 24 }, (_, i) =>
    hourOfDayFormatter.format(new Date(0, 0, 0, i))
  );

  const hourOfDayUTCToCurrentTimezone = (hour: number) => {
    const date = new Date();
    date.setUTCHours(hour);
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      hour12: false,
    });
  };

  const mappedChartData = (data ?? []).map((stat) => ({
    day: dayOfWeekLabels[(stat.dayOfWeek + 7 - 1) % 7],
    hour: hourOfDayUTCToCurrentTimezone(stat.hourOfDay),
    value: stat.count,
  }));

  // https://github.com/carbon-design-system/carbon-charts/pull/1846
  const chartOptions: HeatmapChartOptions & { axes: AreaChartOptions['axes'] } =
    {
      theme: 'g100',
      height: '300px',
      axes: {
        bottom: {
          title: 'Hour of day',
          mapsTo: 'hour',
          scaleType: ScaleTypes.LABELS,
          domain: hourOfDayLabels,
        },
        left: {
          title: 'Day of week',
          mapsTo: 'day',
          scaleType: ScaleTypes.LABELS,
          domain: dayOfWeekLabels.toReversed(), // Needed to make monday appear on top
        },
      },
      heatmap: {
        colorLegend: {
          title: 'Frequency',
          type: 'quantize',
        },
      },
      color: {
        gradient: {
          colors: Array.from({ length: 10 }).map(
            (_, i) => `hsl(var(--primary) / ${(i + 1) / 10})`
          ),
        },
      },
    };
</script>

<!-- Added padding on bottom to make sure heatmap legend is visible -->
<div class="pb-2">
  <HeatmapChart data={mappedChartData} options={chartOptions} />
</div>
