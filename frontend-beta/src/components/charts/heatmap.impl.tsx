import { useMemo } from 'react';
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
  // Labels + options are computed once, matching the Svelte `const`s. They are
  // locale- and timezone-dependent, which is safe here only because the whole
  // chart is client-only (see client-chart.tsx) — it never SSRs, so there is
  // nothing to hydrate-mismatch against.
  //
  // Both the axis `domain` and the data rows go through the SAME formatting
  // helpers, which is what keeps labels and values matching (including the
  // `hour12: false` midnight-as-`24` locales).
  const { labels, chartOptions } = useMemo(() => {
    const hourOfDayFormatter = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      hour12: false,
    });
    const dayOfWeekFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
    });

    // Day-of-week names starting from Monday — Jan 5, 1970 is a Monday.
    const dayOfWeekLabels = Array.from({ length: 7 }, (_, i) =>
      dayOfWeekFormatter.format(new Date(1970, 0, 5 + i))
    );
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

    return {
      labels: {
        dayOfWeekLabels,
        hourOfDayUTCToCurrentTimezone,
      },
      // https://github.com/carbon-design-system/carbon-charts/pull/1846
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
            domain: [...dayOfWeekLabels].reverse(), // makes Monday appear on top
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

  // Keyed on `data`, unlike the options: the Svelte component mapped its rows
  // once at init, so after a season switch (which kept the component mounted)
  // the heatmap still showed the previous season's cells — spec 05 quirk 9,
  // flagged there as "fix it, don't reproduce it".
  const mappedChartData = useMemo(
    () =>
      (data ?? []).map((stat) => ({
        // API dayOfWeek is Sunday=0; shift it onto the Monday-first labels.
        // NOTE: only the hour is converted UTC→local, never the weekday — the
        // documented half-done conversion, reproduced verbatim.
        day: labels.dayOfWeekLabels[(stat.dayOfWeek + 7 - 1) % 7],
        // API hourOfDay is UTC.
        hour: labels.hourOfDayUTCToCurrentTimezone(stat.hourOfDay),
        value: stat.count,
      })),
    [data, labels]
  );

  // Bottom padding keeps the colour legend visible.
  return (
    <div className="pb-2">
      <HeatmapChart data={mappedChartData} options={chartOptions} />
    </div>
  );
}
