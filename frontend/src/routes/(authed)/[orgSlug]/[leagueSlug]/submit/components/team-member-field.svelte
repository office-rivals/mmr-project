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
</script>

<div class="flex flex-col gap-2">
  <h4>{label}</h4>
  {#if value === null}
    <Input
      bind:value={filter}
      placeholder="Filter..."
      autofocus={autofocus ? autofocus : undefined}
    />
    {#if filter.length === 0 && latestPlayers.length > 0}
      <p class="text-sm">Recent players</p>
      <ul>
        {#each latestPlayers as player (player.id)}
          <li class="mb-1 last:mb-0">
            <PlayerButton user={player} onclick={() => selectPlayer(player)} />
          </li>
        {/each}
      </ul>
    {/if}
    {#if filter.length > 1}
      {#if matchedPlayers.length > 0 || matchedMembers.length > 0}
        <ul>
          {#each matchedPlayers as player (player.id)}
            <li class="mb-1">
              <PlayerButton
                user={player}
                onclick={() => selectPlayer(player)}
              />
            </li>
          {/each}
          {#if matchedMembers.length > 0}
            <li class="mb-1 mt-2 text-xs text-muted-foreground">
              Org members not yet in league
            </li>
            {#each matchedMembers as member (member.id)}
              <li class="mb-1">
                <PlayerButton
                  user={{
                    displayName: member.displayName,
                    username: member.username,
                  }}
                  onclick={() => selectMember(member)}
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
