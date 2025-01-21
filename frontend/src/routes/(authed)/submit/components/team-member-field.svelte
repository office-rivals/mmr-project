<script lang="ts">
  import PlayerButton from '$lib/components/player-button.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { Input } from '$lib/components/ui/input';
  import { isPresent } from '$lib/util/isPresent';
  import X from 'lucide-svelte/icons/x';
  import type { UserDetails } from '../../../../api';

  export let label: string;
  export let userId: number | null;
  export let users: UserDetails[];
  export let latestPlayerIds: number[];
  export let availableUsers: UserDetails[] = [];

  export let onCreateUser: (suggested: string) => void;

  const resetValue = () => {
    userId = null;
  };

  let filter = '';

  $: filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(filter.toLowerCase()) ||
      (u.displayName != null &&
        u.displayName.toLowerCase().includes(filter.toLowerCase()))
  );
  $: user = users.find((u) => u.userId === userId);
  $: latestPlayers = latestPlayerIds
    .map((id) => availableUsers.find((u) => u.userId === id))
    .filter(isPresent)
    .slice(0, 4);

  const selectUser = (user: UserDetails) => {
    userId = user.userId;
    filter = '';
  };
</script>

<div class="flex flex-col gap-2">
  <h4>{label}</h4>
  {#if userId == null}
    <Input bind:value={filter} placeholder="Filter..." autofocus />
    {#if filter.length === 0 && latestPlayers.length > 0}
      <p class="text-sm">Recent players</p>
      <ul>
        {#each latestPlayers as latestPlayer}
          <li class="mb-1 last:mb-0">
            <PlayerButton
              user={latestPlayer}
              on:click={() => selectUser(latestPlayer)}
            />
          </li>
        {/each}
      </ul>
    {/if}
    {#if filter.length > 1}
      {#if filteredUsers.length > 0}
        <ul>
          {#each filteredUsers as user}
            <li>
              <PlayerButton {user} on:click={() => selectUser(user)} />
            </li>
          {/each}
        </ul>
      {:else}
        <div class="flex flex-col items-start gap-1">
          <p class="text-sm">No users found</p>
          <Button on:click={() => onCreateUser(filter)}>Add new user</Button>
        </div>
      {/if}
    {/if}
  {:else}
    <div
      class="border-input flex w-full items-center gap-1 rounded-md border px-3 py-2"
    >
      <div class="flex flex-1 flex-col gap-2">
        {#if user != null}
          <p class="line-clamp-1 text-sm md:text-base">
            {user.displayName ?? user.name}
          </p>
          <p class="text-xs">
            {#if user.displayName != null}
              {user.name}
            {:else}
              &nbsp;
            {/if}
          </p>
        {:else}
          <p>Unknown</p>
        {/if}
      </div>
      <Button
        class="-mr-1 h-7 w-7 rounded p-1 text-sm"
        on:click={resetValue}
        variant="ghost"
      >
        <X class="h-full w-full" />
      </Button>
    </div>
  {/if}
</div>
