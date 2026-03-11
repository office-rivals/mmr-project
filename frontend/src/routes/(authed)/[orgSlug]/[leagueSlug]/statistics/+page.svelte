<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import LineChart from '$lib/components/ui/line-chart/line-chart.svelte';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const chartData = $derived(
    data.statistics?.map(
      (stat: { name: string; date: string; mmr: number }) => ({
        player: stat.name,
        date: stat.date,
        rating: stat.mmr,
      })
    ) ?? []
  );
</script>

<div class="flex flex-col gap-4">
  <PageTitle>Statistics</PageTitle>
  <LineChart data={chartData} height={500} />
</div>
