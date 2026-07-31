<script lang="ts">
  import PlayerButton from '$lib/components/player-button.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { Input } from '$lib/components/ui/input';
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
  let highlighted = $state(0);

  const listId = $props.id();
  const optionId = (i: number) => `${listId}-${i}`;

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

  function selectPlayer(player: LeaguePlayerResponse) {
    onChange({ kind: 'league', player });
    filter = '';
  }

  function selectMember(member: OrganizationMemberResponse) {
    onChange({ kind: 'member', member });
    filter = '';
  }

  function reset() {
    onChange(null);
    filter = '';
  }

  // The "recent" list and the filtered list never render at the same time, so a
  // single index covers whichever list is visible.
  let options = $derived(
    filter.length === 0
      ? latestPlayers.map((p) => () => selectPlayer(p))
      : filter.length > 1
        ? [
            ...matchedPlayers.map((p) => () => selectPlayer(p)),
            ...matchedMembers.map((m) => () => selectMember(m)),
          ]
        : []
  );

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      highlighted = (highlighted + step + options.length) % options.length;
    } else if (e.key === 'Enter') {
      // Never let Enter submit the match from a filter input.
      // ponytail: no suggestion highlighted (nothing matched) = no-op.
      e.preventDefault();
      options[highlighted]?.();
    } else if (e.key === 'Escape') {
      filter = '';
    }
  }
</script>

<div class="flex flex-col gap-2">
  <h4>{label}</h4>
  {#if value === null}
    <Input
      bind:value={filter}
      placeholder="Filter..."
      autofocus={autofocus ? autofocus : undefined}
      spellcheck={false}
      autocorrect="off"
      autocapitalize="none"
      {onkeydown}
      oninput={() => (highlighted = 0)}
      role="combobox"
      aria-controls={listId}
      aria-expanded={options.length > 0}
      aria-activedescendant={options.length > 0
        ? optionId(highlighted)
        : undefined}
    />
    {#if filter.length === 0 && latestPlayers.length > 0}
      <p class="text-sm">Recent players</p>
      <ul id={listId} role="listbox">
        {#each latestPlayers as player, i (player.id)}
          <li class="mb-1 last:mb-0" role="presentation">
            <PlayerButton
              user={player}
              onclick={() => selectPlayer(player)}
              id={optionId(i)}
              role="option"
              aria-selected={highlighted === i}
              class={highlighted === i ? 'border-primary bg-muted' : undefined}
            />
          </li>
        {/each}
      </ul>
    {/if}
    {#if filter.length > 1}
      {#if matchedPlayers.length > 0 || matchedMembers.length > 0}
        <ul id={listId} role="listbox">
          {#each matchedPlayers as player, i (player.id)}
            <li class="mb-1" role="presentation">
              <PlayerButton
                user={player}
                onclick={() => selectPlayer(player)}
                id={optionId(i)}
                role="option"
                aria-selected={highlighted === i}
                class={highlighted === i
                  ? 'border-primary bg-muted'
                  : undefined}
              />
            </li>
          {/each}
          {#if matchedMembers.length > 0}
            <li
              class="mb-1 mt-2 text-xs text-muted-foreground"
              role="presentation"
            >
              Org members not yet in league
            </li>
            {#each matchedMembers as member, i (member.id)}
              {@const idx = matchedPlayers.length + i}
              <li class="mb-1" role="presentation">
                <PlayerButton
                  user={{
                    displayName: member.displayName,
                    username: member.username,
                  }}
                  onclick={() => selectMember(member)}
                  id={optionId(idx)}
                  role="option"
                  aria-selected={highlighted === idx}
                  class={highlighted === idx
                    ? 'border-primary bg-muted'
                    : undefined}
                />
              </li>
            {/each}
          {/if}
        </ul>
      {:else}
        <div class="flex flex-col items-start gap-1">
          <p class="text-sm">No players found</p>
          <Button type="button" onclick={() => onCreateUser(filter)}>
            Add new player
          </Button>
        </div>
      {/if}
    {/if}
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
