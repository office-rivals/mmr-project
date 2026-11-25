<script lang="ts">
  import PlayerButton from '$lib/components/player-button.svelte';
  import { Input } from '$lib/components/ui/input';
  import { Combobox } from 'bits-ui';
  import { tick, untrack } from 'svelte';
  import type { LeaguePlayerResponse } from '$api3/models';

  interface Props {
    players: LeaguePlayerResponse[];
    onSelected: (playerId: string) => void;
    autofocus?: boolean;
  }

  let { players, onSelected, autofocus = false }: Props = $props();

  let filter = $state('');
  // An autofocused input is focused by the browser before this component's
  // focus handler is attached, so the focus event never reaches us.
  let open = $state(untrack(() => autofocus));
  let highlightedValue = $state<string | null>(null);
  let inputRef = $state<HTMLInputElement | null>(null);
  // This picker stays mounted across picks, but bits-ui keeps the selected
  // value and owns the input's text. Remounting it is what resets both, so the
  // box clears and the same player can be picked again after their chip goes.
  let instance = $state(0);

  // The input's text has two owners: `filter` here and bits-ui's own input
  // state. Both listen for `input`, so dispatching one is how they stay in sync
  // with a value that was put in the DOM directly.
  const replayInput = (el: HTMLInputElement) =>
    el.dispatchEvent(new Event('input', { bubbles: true }));

  // A fill or paste can land on the server-rendered input before this component
  // hydrates, and no input event follows it — Svelte's `bind:value` keeps the
  // typed text but neither owner hears about it, leaving the picker stranded.
  $effect(() => {
    if (inputRef?.value) replayInput(inputRef);
  });

  function clearFilter() {
    if (inputRef) {
      inputRef.value = '';
      replayInput(inputRef);
    }
    filter = '';
    open = false;
    highlightedValue = null;
  }

  let filtered = $derived(
    players.filter((p) => {
      const name = (p.displayName ?? '') + ' ' + (p.username ?? '');
      return name.toLowerCase().includes(filter.toLowerCase());
    })
  );

  async function select(playerId: string) {
    onSelected(playerId);
    filter = '';
    open = false;
    highlightedValue = null;
    instance += 1;
    await tick();
    inputRef?.focus();
  }

  function onkeydown(e: KeyboardEvent) {
    // An IME confirms its candidate with Enter; that keypress is not a pick.
    if (e.isComposing) return;
    if (e.key === 'Escape') {
      clearFilter();
      return;
    }
    if (e.key !== 'Enter') return;
    // Handled here rather than by bits-ui, which selects only an
    // already-highlighted item and so ignores a freshly typed filter.
    e.preventDefault();
    if (!open || filter.length < 2) return;
    // Nothing matched = no-op.
    const target =
      highlightedValue && filtered.some((p) => p.id === highlightedValue)
        ? highlightedValue
        : filtered[0]?.id;
    if (target) select(target);
  }
</script>

<div class="relative flex flex-col gap-2">
  {#key instance}
    <Combobox.Root type="single" loop bind:open onValueChange={select}>
      <Combobox.Input
        bind:ref={inputRef}
        placeholder="Filter..."
        autofocus={autofocus ? autofocus : undefined}
        oninput={(e) => {
          filter = e.currentTarget.value;
          // Covers input that arrives without a keydown (paste, autofill).
          open = true;
        }}
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
  {/key}
</div>
