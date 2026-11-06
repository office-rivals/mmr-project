import { useEffect, useMemo, useRef } from 'react';
import {
  HeatmapChart,
  ScaleTypes,
  type AreaChartOptions,
  type HeatmapChartOptions,
} from './carbon-charts';

export interface HeatmapProps {
  data: Array<{
    dayOfWeek: number;
    hourOfDay: number;
    count: number;
  }>;
}

export default function HeatmapImpl({ data }: HeatmapProps) {
  const chartRef = useRef<InstanceType<typeof HeatmapChart>>(null);
  const { labels, chartOptions } = useMemo(() => {
    const hourOfDayFormatter = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      hour12: false,
    });
    const dayOfWeekFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
    });

    // Jan 5, 1970 anchors locale-formatted labels to a Monday.
    const dayOfWeekLabels = Array.from({ length: 7 }, (_, i) =>
      dayOfWeekFormatter.format(new Date(1970, 0, 5 + i))
    );
    const hourOfDayLabels = Array.from({ length: 24 }, (_, i) =>
      hourOfDayFormatter.format(new Date(0, 0, 0, i))
    );

    const hourOfDayUTCToCurrentTimezone = (hour: number) => {
      const date = new Date();
      date.setUTCHours(hour);
      return hourOfDayFormatter.format(date);
    };

    return {
      labels: {
        dayOfWeekLabels,
        hourOfDayUTCToCurrentTimezone,
      },
      chartOptions: {
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
            domain: [...dayOfWeekLabels].reverse(),
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
      } as HeatmapChartOptions & { axes: AreaChartOptions['axes'] },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init-once by design
  }, []);

  const mappedChartData = useMemo(
    () =>
      (data ?? []).map((stat) => ({
        // The API uses Sunday=0; chart labels start on Monday.
        day: labels.dayOfWeekLabels[(stat.dayOfWeek + 7 - 1) % 7],
        hour: labels.hourOfDayUTCToCurrentTimezone(stat.hourOfDay),
        value: stat.count,
      })),
    [data, labels]
  );

  useEffect(() => {
    const chart = chartRef.current?.chart;
    if (!chart) return;

    // The Svelte wrapper reapplies these after the holder reaches its final width.
    chart.model.setData(mappedChartData);
    chart.model.setOptions(chartOptions);
  }, [chartOptions, mappedChartData]);

  return (
    <div className="pb-2">
      <HeatmapChart
        ref={chartRef}
        data={mappedChartData}
        options={chartOptions}
      />
    </div>
  );
}
