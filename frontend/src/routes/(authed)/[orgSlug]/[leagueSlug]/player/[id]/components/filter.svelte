<script lang="ts">
  import PlayerButton from '$lib/components/player-button.svelte';
  import { Input } from '$lib/components/ui/input';
  import type { LeaguePlayerResponse } from '$api3/models';

  interface Props {
    players: LeaguePlayerResponse[];
    onSelected: (playerId: string) => void;
    autofocus?: boolean;
  }

  let { players, onSelected, autofocus = false }: Props = $props();

  let filter = $state('');

  let filtered = $derived(
    players.filter((p) => {
      const name = (p.displayName ?? '') + ' ' + (p.username ?? '');
      return name.toLowerCase().includes(filter.toLowerCase());
    })
  );

  const select = (player: LeaguePlayerResponse) => {
    onSelected(player.id);
    filter = '';
  };
</script>

<div class="relative flex flex-col gap-2">
  <Input
    bind:value={filter}
    placeholder="Filter..."
    autofocus={autofocus ? autofocus : undefined}
  />
  {#if filter.length > 1}
    {#if filtered.length > 0}
      <ul class="absolute top-[100%] z-10 mt-3 w-full space-y-2">
        {#each filtered as player (player.id)}
          <li>
            <PlayerButton
              user={player}
              onclick={() => select(player)}
              class="bg-background"
            />
          </li>
        {/each}
      </ul>
    {:else}
      <div class="flex flex-col items-start gap-1">
        <p class="text-sm">No players found</p>
      </div>
    {/if}
  {/if}
</div>
