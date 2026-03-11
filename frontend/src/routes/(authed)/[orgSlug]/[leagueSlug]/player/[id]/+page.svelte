<script lang="ts">
  import Kpi from '$lib/components/kpi.svelte';
  import PageTitle from '$lib/components/page-title.svelte';
  import LineChart from '$lib/components/ui/line-chart/line-chart.svelte';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const chartData = $derived(
    data.ratingHistory?.entries?.map(
      (e: { recordedAt: string; mmr: number }) => ({
        date: e.recordedAt,
        player: data.player.displayName ?? data.player.username ?? 'Player',
        rating: e.mmr,
      })
    ) ?? []
  );

  const profileSuffix = data.isCurrentUser ? ' - You' : '';
</script>

<div class="flex flex-col gap-6">
  {#if data.player?.displayName}
    <PageTitle
      >{data.player.displayName} ({data.player.username}){profileSuffix}</PageTitle
    >
  {:else}
    <PageTitle>{data.player?.username ?? 'Player'}{profileSuffix}</PageTitle>
  {/if}

  <div class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
    <Kpi title="MMR">{data.stats.mmr ?? 'N/A'}</Kpi>
    <Kpi title="# Matches">{data.stats.totalMatches}</Kpi>
    <Kpi title="# Wins">{data.stats.wins}</Kpi>
    <Kpi title="# Losses">{data.stats.losses}</Kpi>
    <Kpi title="Win rate">
      {new Intl.NumberFormat(undefined, {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(data.stats.winrate)}
    </Kpi>
  </div>

  {#if chartData.length > 0}
    <h2 class="-mb-6 mt-6 text-2xl md:text-4xl">Rating over time</h2>
    <LineChart data={chartData} height={300} legend={false} />
  {/if}

  {#if data.matches.length > 0}
    <h2 class="text-2xl md:text-4xl">Matches</h2>
    <div class="flex flex-1 flex-col items-stretch gap-2">
      {#each data.matches as match}
        <div class="bg-card rounded-lg border p-3">
          <div class="flex items-center justify-between text-sm">
            {#each match.teams as team}
              <div class="flex flex-col items-center gap-1">
                <span class="text-lg font-bold">{team.score}</span>
                {#each team.players as player}
                  <a
                    href="/{data.orgSlug}/{data.leagueSlug}/player/{player.leaguePlayerId}"
                    class="hover:underline"
                  >
                    {player.displayName ?? player.username ?? 'Unknown'}
                  </a>
                {/each}
                {#if team.isWinner}
                  <span class="text-xs font-semibold text-green-600"
                    >Winner</span
                  >
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
