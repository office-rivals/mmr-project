<script lang="ts">
  import PlayerButton from '$lib/components/player-button.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { Input } from '$lib/components/ui/input';
  import { Combobox } from 'bits-ui';
  import { untrack } from 'svelte';
  import X from 'lucide-svelte/icons/x';
  import type { LeaguePlayerResponse, OrganizationMemberResponse } from '$api3';

  export type SlotValue =
    | { kind: 'league'; player: LeaguePlayerResponse }
    | { kind: 'member'; member: OrganizationMemberResponse }
    | { kind: 'new'; displayName: string; username: string; email: string }
    | null;

  interface Props {
    label: string;
    value: SlotValue;
    onChange: (value: SlotValue) => void;
    leaguePlayers: LeaguePlayerResponse[];
    orgMembers: OrganizationMemberResponse[];
    latestPlayerIds: string[];
    excludeIds: string[];
    onCreateUser: (suggested: string) => void;
    autofocus?: boolean;
  }

  let {
    label,
    value,
    onChange,
    leaguePlayers,
    orgMembers,
    latestPlayerIds,
    excludeIds,
    onCreateUser,
    autofocus = false,
  }: Props = $props();

  let filter = $state('');
  // An autofocused slot is focused by the browser before this component's focus
  // handler is attached, so the focus event never reaches us — start open
  // instead of waiting for one.
  let open = $state(untrack(() => autofocus));
  let highlightedValue = $state<string | null>(null);
  let arrowed = $state(false);

  const playerName = (p: {
    displayName?: string;
    username?: string;
    email?: string;
  }) => p.displayName ?? p.username ?? p.email ?? 'Unknown';

  const matches = (text: string) =>
    text.toLowerCase().includes(filter.toLowerCase());

  let matchedPlayers = $derived(
    leaguePlayers.filter(
      (p) =>
        !excludeIds.includes(`league:${p.id}`) &&
        (matches(p.displayName ?? '') || matches(p.username ?? ''))
    )
  );

  let leagueMembershipIds = $derived(
    new Set(leaguePlayers.map((p) => p.organizationMembershipId))
  );

  let matchedMembers = $derived(
    orgMembers.filter(
      (m) =>
        !leagueMembershipIds.has(m.id) &&
        !excludeIds.includes(`member:${m.id}`) &&
        (matches(m.displayName ?? '') ||
          matches(m.username ?? '') ||
          matches(m.email ?? ''))
    )
  );

  let latestPlayers = $derived(
    latestPlayerIds
      .map((id) => leaguePlayers.find((p) => p.id === id))
      .filter((p): p is LeaguePlayerResponse => !!p)
      .filter((p) => !excludeIds.includes(`league:${p.id}`))
      .slice(0, 4)
  );

  // Option values reuse the `league:` / `member:` encoding the parent already
  // uses for excludeIds and the hidden form fields. In render order, so
  // options[0] is the top suggestion.
  let options = $derived(
    filter.length === 0
      ? latestPlayers.map((p) => `league:${p.id}`)
      : filter.length > 1
        ? [
            ...matchedPlayers.map((p) => `league:${p.id}`),
            ...matchedMembers.map((m) => `member:${m.id}`),
          ]
        : []
  );

  function select(optionValue: string) {
    const player = leaguePlayers.find((p) => `league:${p.id}` === optionValue);
    if (player) {
      onChange({ kind: 'league', player });
      return;
    }
    const member = orgMembers.find((m) => `member:${m.id}` === optionValue);
    if (member) onChange({ kind: 'member', member });
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // bits-ui moves the highlight itself; just remember the user picked it,
      // so Enter never acts on the item bits-ui highlights when the list opens.
      arrowed = true;
      return;
    }
    if (e.key !== 'Enter') return;
    // Enter must never reach the form — implicit submission posts an empty
    // match. Handling it here also replaces bits-ui's own Enter (composed
    // handlers stop at the first preventDefault), which selects only an
    // already-highlighted item and so ignores a freshly typed filter.
    e.preventDefault();
    if (!open) return;
    // ponytail: an untouched list of recents is not a choice — Enter only picks
    // a typed match or an option the user arrowed to.
    const target =
      arrowed && highlightedValue && options.includes(highlightedValue)
        ? highlightedValue
        : filter.length > 1
          ? options[0]
          : undefined;
    if (target) select(target);
  }

  function reset() {
    onChange(null);
    filter = '';
  }
</script>

{#snippet option(
  optionValue: string,
  user: { displayName?: string; username?: string; email?: string }
)}
  <Combobox.Item
    value={optionValue}
    label={playerName(user)}
    onHighlight={() => (highlightedValue = optionValue)}
    onUnhighlight={() => {
      if (highlightedValue === optionValue) highlightedValue = null;
    }}
  >
    {#snippet child({ props })}
      <PlayerButton
        {...props}
        {user}
        class="data-[highlighted]:border-primary data-[highlighted]:bg-muted"
      />
    {/snippet}
  </Combobox.Item>
{/snippet}

<div class="flex flex-col gap-2">
  <h4>{label}</h4>
  {#if value === null}
    <Combobox.Root type="single" loop bind:open onValueChange={select}>
      <Combobox.Input
        placeholder="Filter..."
        autofocus={autofocus ? autofocus : undefined}
        spellcheck={false}
        autocorrect="off"
        autocapitalize="none"
        oninput={(e) => {
          filter = e.currentTarget.value;
          // Covers input that arrives without a keydown (paste, autofill).
          open = true;
          arrowed = false;
        }}
        onfocus={() => (open = true)}
        onclick={() => (open = true)}
        {onkeydown}
      >
        {#snippet child({ props })}
          <Input {...props} />
        {/snippet}
      </Combobox.Input>
      <Combobox.ContentStatic class="gap-1">
        {#if filter.length === 0}
          {#if latestPlayers.length > 0}
            <Combobox.Group class="flex flex-col gap-1">
              <Combobox.GroupHeading class="text-sm">
                Recent players
              </Combobox.GroupHeading>
              {#each latestPlayers as player (player.id)}
                {@render option(`league:${player.id}`, player)}
              {/each}
            </Combobox.Group>
          {/if}
        {:else if filter.length > 1}
          {#if options.length > 0}
            {#each matchedPlayers as player (player.id)}
              {@render option(`league:${player.id}`, player)}
            {/each}
            {#if matchedMembers.length > 0}
              <Combobox.Group class="flex flex-col gap-1">
                <Combobox.GroupHeading
                  class="mt-1 text-xs text-muted-foreground"
                >
                  Org members not yet in league
                </Combobox.GroupHeading>
                {#each matchedMembers as member (member.id)}
                  {@render option(`member:${member.id}`, member)}
                {/each}
              </Combobox.Group>
            {/if}
          {:else}
            <div class="flex flex-col items-start gap-1">
              <p class="text-sm">No players found</p>
              <Button type="button" onclick={() => onCreateUser(filter)}>
                Add new player
              </Button>
            </div>
          {/if}
        {/if}
      </Combobox.ContentStatic>
    </Combobox.Root>
  {:else}
    <div
      class="flex w-full items-center gap-1 rounded-md border border-input px-3 py-2"
    >
      <div class="flex flex-1 flex-col gap-1">
        {#if value.kind === 'league'}
          <p class="line-clamp-1 text-sm md:text-base">
            {playerName(value.player)}
          </p>
          {#if value.player.displayName && value.player.username}
            <p class="text-xs">{value.player.username}</p>
          {/if}
        {:else if value.kind === 'member'}
          <p class="line-clamp-1 text-sm md:text-base">
            {playerName(value.member)}
          </p>
          <p class="text-xs">Org member · joining league</p>
        {:else if value.kind === 'new'}
          <p class="line-clamp-1 text-sm md:text-base">{value.displayName}</p>
          <p class="text-xs">
            {value.email ? `New player · ${value.email}` : 'New player'}
          </p>
        {/if}
      </div>
      <Button
        type="button"
        class="-mr-1 h-7 w-7 rounded p-1 text-sm"
        onclick={reset}
        variant="ghost"
      >
        <X class="h-full w-full" />
      </Button>
    </div>
  {/if}
</div>
