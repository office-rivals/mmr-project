<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import { Button } from '$lib/components/ui/button';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let team1Player1: string = $state('');
  let team1Player2: string = $state('');
  let team1Score: number = $state(0);
  let team2Player1: string = $state('');
  let team2Player2: string = $state('');
  let team2Score: number = $state(0);

  const players = $derived(data.players ?? []);

  function availablePlayers(currentValue: string) {
    const selected = [team1Player1, team1Player2, team2Player1, team2Player2].filter(Boolean);
    return players.filter((p: { id: string }) => p.id === currentValue || !selected.includes(p.id));
  }
</script>

<div class="flex flex-col gap-8">
  <PageTitle>Submit Match</PageTitle>

  <form method="post" class="flex flex-col gap-6">
    <div class="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <h3 class="text-lg font-semibold">Team 1</h3>
      <label class="flex flex-col gap-1">
        Player 1
        <select
          name="team1_player1"
          bind:value={team1Player1}
          class="rounded border p-2"
        >
          <option value="">Select player...</option>
          {#each availablePlayers(team1Player1) as player}
            <option value={player.id}>
              {player.displayName ?? player.username}
            </option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-1">
        Player 2
        <select
          name="team1_player2"
          bind:value={team1Player2}
          class="rounded border p-2"
        >
          <option value="">Select player...</option>
          {#each availablePlayers(team1Player2) as player}
            <option value={player.id}>
              {player.displayName ?? player.username}
            </option>
          {/each}
        </select>
      </label>
      <label class="flex items-center gap-2">
        Score:
        <input
          type="number"
          name="team1_score"
          bind:value={team1Score}
          min="0"
          max="99"
          class="w-20 rounded border p-2"
        />
      </label>
    </div>

    <div class="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <h3 class="text-lg font-semibold">Team 2</h3>
      <label class="flex flex-col gap-1">
        Player 1
        <select
          name="team2_player1"
          bind:value={team2Player1}
          class="rounded border p-2"
        >
          <option value="">Select player...</option>
          {#each availablePlayers(team2Player1) as player}
            <option value={player.id}>
              {player.displayName ?? player.username}
            </option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-1">
        Player 2
        <select
          name="team2_player2"
          bind:value={team2Player2}
          class="rounded border p-2"
        >
          <option value="">Select player...</option>
          {#each availablePlayers(team2Player2) as player}
            <option value={player.id}>
              {player.displayName ?? player.username}
            </option>
          {/each}
        </select>
      </label>
      <label class="flex items-center gap-2">
        Score:
        <input
          type="number"
          name="team2_score"
          bind:value={team2Score}
          min="0"
          max="99"
          class="w-20 rounded border p-2"
        />
      </label>
    </div>

    <Button type="submit" class="w-full">Submit Match</Button>
  </form>
</div>
