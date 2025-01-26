<script lang="ts">
  import { browser } from '$app/environment';
  import PageTitle from '$lib/components/page-title.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import { getRandomTeamsSessionStorageKey } from '$lib/util/session';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let players = $state([
    data.players[0] ?? '',
    data.players[1] ?? '',
    data.players[2] ?? '',
    data.players[3] ?? '',
  ]);

  var teams: string[][] = $state(data.teams);
  function generateTeams() {
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    teams = [shuffledPlayers.slice(0, 2), shuffledPlayers.slice(2, 4)];

    if (browser) {
      sessionStorage.setItem(
        getRandomTeamsSessionStorageKey(players),
        JSON.stringify(teams)
      );
    }
  }
</script>

<div class="flex flex-col gap-8">
  <PageTitle>Random Team Generator</PageTitle>
  <div class="grid grid-cols-2 gap-4">
    {#each players as player, idx}
      <div class="flex flex-col gap-2">
        <Label for="player-{idx}">Player {idx + 1}</Label>
        <Input id="player-{idx}" bind:value={players[idx]} />
      </div>
    {/each}
  </div>
  <Button
    type="button"
    disabled={players.some((p) => p == null || p.trim() === '')}
    onclick={generateTeams}>Generate Teams</Button
  >
  {#if teams.length === 2}
    <div class="flex flex-row gap-4 text-center">
      <div class="flex flex-1 flex-col">
        <h3 class="text-2xl">Team 1</h3>
        <ul>
          {#each teams[0] as player}
            <li>{player}</li>
          {/each}
        </ul>
      </div>
      <div class="flex-s bg-border min-h-full w-px"></div>
      <div class="flex flex-1 flex-col">
        <h3 class="text-2xl">Team 2</h3>
        <ul>
          {#each teams[1] as player}
            <li>{player}</li>
          {/each}
        </ul>
      </div>
    </div>
    <Button
      href="/submit?player1={teams[0][0]}&player2={teams[0][1]}&player3={teams[1][0]}&player4={teams[1][1]}"
    >
      Submit result
    </Button>
  {/if}
</div>
