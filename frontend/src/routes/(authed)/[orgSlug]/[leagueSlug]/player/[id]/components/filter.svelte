<script lang="ts">
  import PlayerButton from '$lib/components/player-button.svelte';
  import { Input } from '$lib/components/ui/input';
  import { Combobox } from 'bits-ui';
  import type { LeaguePlayerResponse } from '$api3/models';

  interface Props {
    players: LeaguePlayerResponse[];
    onSelected: (playerId: string) => void;
    autofocus?: boolean;
  }

  let { players, onSelected, autofocus = false }: Props = $props();

  let filter = $state('');
  let open = $state(false);
  let highlightedValue = $state<string | null>(null);

  let filtered = $derived(
    players.filter((p) => {
      const name = (p.displayName ?? '') + ' ' + (p.username ?? '');
      return name.toLowerCase().includes(filter.toLowerCase());
    })
  );

  const select = (playerId: string) => {
    onSelected(playerId);
    filter = '';
  };

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    // Handled here rather than by bits-ui, which selects only an
    // already-highlighted item and so ignores a freshly typed filter.
    e.preventDefault();
    if (!open || filter.length < 2) return;
    // ponytail: nothing matched = no-op.
    const target =
      highlightedValue && filtered.some((p) => p.id === highlightedValue)
        ? highlightedValue
        : filtered[0]?.id;
    if (target) select(target);
  }
</script>

<div class="relative flex flex-col gap-2">
  <Combobox.Root type="single" loop bind:open onValueChange={select}>
    <Combobox.Input
      placeholder="Filter..."
      autofocus={autofocus ? autofocus : undefined}
      oninput={(e) => (filter = e.currentTarget.value)}
      onfocus={() => (open = true)}
      onclick={() => (open = true)}
      {onkeydown}
    >
      {#snippet child({ props })}
        <Input {...props} />
      {/snippet}
    </Combobox.Input>
    {#if filter.length > 1}
      <Combobox.ContentStatic
        class="absolute top-[100%] z-10 mt-3 w-full gap-2"
      >
        {#if filtered.length > 0}
          {#each filtered as player (player.id)}
            <Combobox.Item
              value={player.id}
              label={player.displayName ?? player.username ?? 'Unknown'}
              onHighlight={() => (highlightedValue = player.id)}
              onUnhighlight={() => {
                if (highlightedValue === player.id) highlightedValue = null;
              }}
            >
              {#snippet child({ props })}
                <PlayerButton
                  {...props}
                  user={player}
                  class="bg-background data-[highlighted]:border-primary data-[highlighted]:bg-muted"
                />
              {/snippet}
            </Combobox.Item>
          {/each}
        {:else}
          <p class="text-sm">No players found</p>
        {/if}
      </Combobox.ContentStatic>
    {/if}
  </Combobox.Root>
</div>
