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
  let highlighted = $state(0);

  const listId = $props.id();
  const optionId = (i: number) => `${listId}-${i}`;

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

  let options = $derived(
    filter.length > 1 ? filtered.map((p) => () => select(p)) : []
  );

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      highlighted = (highlighted + step + options.length) % options.length;
    } else if (e.key === 'Enter') {
      // ponytail: nothing matched = no-op.
      e.preventDefault();
      options[highlighted]?.();
    } else if (e.key === 'Escape') {
      filter = '';
    }
  }
</script>

<div class="relative flex flex-col gap-2">
  <Input
    bind:value={filter}
    placeholder="Filter..."
    autofocus={autofocus ? autofocus : undefined}
    {onkeydown}
    oninput={() => (highlighted = 0)}
    role="combobox"
    aria-controls={listId}
    aria-expanded={options.length > 0}
    aria-activedescendant={options.length > 0
      ? optionId(highlighted)
      : undefined}
  />
  {#if filter.length > 1}
    {#if filtered.length > 0}
      <ul
        id={listId}
        role="listbox"
        class="absolute top-[100%] z-10 mt-3 w-full space-y-2"
      >
        {#each filtered as player, i (player.id)}
          <li role="presentation">
            <PlayerButton
              user={player}
              onclick={() => select(player)}
              id={optionId(i)}
              role="option"
              aria-selected={highlighted === i}
              class={highlighted === i
                ? 'border-primary bg-muted'
                : 'bg-background'}
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
