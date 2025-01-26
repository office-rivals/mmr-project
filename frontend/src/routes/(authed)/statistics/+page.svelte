<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import Heatmap from '$lib/components/ui/heatmap/heatmap.svelte';
  import LineChart from '$lib/components/ui/line-chart/line-chart.svelte';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const chartData =
    data.statistics?.map((stat) => ({
      player: stat.name,
      date: stat.date,
      rating: stat.mmr,
    })) ?? [];
</script>

<PageTitle>Statistics</PageTitle>

<LineChart data={chartData} height={500} />

<Heatmap data={data.timeDistribution ?? []} />
