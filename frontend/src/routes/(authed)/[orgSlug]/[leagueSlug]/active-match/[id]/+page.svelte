<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import { Button } from '$lib/components/ui/button';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let team1Score: number = $state(0);
  let team2Score: number = $state(0);

  const teams = $derived(
    [...(data.activeMatch?.teams ?? [])].sort(
      (a: { index: number }, b: { index: number }) => a.index - b.index
    )
  );

  const playerName = (leaguePlayerId: string) => {
    const player = data.players?.find(
      (p: { id: string }) => p.id === leaguePlayerId
    );
    return player?.displayName ?? player?.username ?? 'Unknown';
  };
</script>

<div class="flex flex-col gap-8">
  <PageTitle>Submit Match Result</PageTitle>

  <form method="post" class="flex flex-col gap-6">
    {#each teams as team, i}
      <div class="bg-card flex flex-col gap-2 rounded-lg border p-4">
        <h3 class="text-lg font-semibold">Team {i + 1}</h3>
        <div class="flex flex-col gap-1">
          {#each team.players as player}
            <span>{playerName(player.leaguePlayerId)}</span>
          {/each}
        </div>
        <label class="flex items-center gap-2">
          Score:
          {#if i === 0}
            <input
              type="number"
              name="team1_score"
              bind:value={team1Score}
              min="0"
              max="99"
              class="w-20 rounded border p-2"
            />
          {:else}
            <input
              type="number"
              name="team2_score"
              bind:value={team2Score}
              min="0"
              max="99"
              class="w-20 rounded border p-2"
            />
          {/if}
        </label>
      </div>
    {/each}

    <Button type="submit" class="w-full">Submit Result</Button>
  </form>
</div>
