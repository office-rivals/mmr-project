<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import SeasonPicker from '$lib/components/season-picker.svelte';
  import Heatmap from '$lib/components/ui/heatmap/heatmap.svelte';
  import LineChart from '$lib/components/ui/line-chart/line-chart.svelte';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const chartData = $derived(
    data.statistics?.map((stat) => ({
      player: stat.name,
      date: stat.date,
      rating: stat.mmr,
    })) ?? []
  );
</script>

<div class="flex flex-col gap-4">
  <PageTitle>Statistics</PageTitle>
  {#if data.seasons != null && data.seasons.length > 1}
    <div class="self-end">
      <SeasonPicker seasons={data.seasons} currentSeason={data.currentSeason} />
    </div>
  {/if}
  <LineChart data={chartData} height={500} />

  <Heatmap data={data.timeDistribution ?? []} />
</div>
