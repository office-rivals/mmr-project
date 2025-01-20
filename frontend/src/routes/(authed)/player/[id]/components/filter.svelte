<script lang="ts">
  import type { UserDetails } from '$api';
  import PlayerButton from '$lib/components/player-button.svelte';
  import { Input } from '$lib/components/ui/input';

  export let users: UserDetails[];
  export let onSelectedUser: (userId: number) => void;
  export let autofocus = false;

  let filter = '';

  $: filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(filter.toLowerCase()) ||
      (u.displayName != null &&
        u.displayName.toLowerCase().includes(filter.toLowerCase()))
  );

  const selectUser = (user: UserDetails) => {
    onSelectedUser(user.userId);
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
    {#if filteredUsers.length > 0}
      <ul class="absolute top-[100%] z-10 mt-3 w-full space-y-2">
        {#each filteredUsers as user}
          <li>
            <PlayerButton
              {user}
              on:click={() => selectUser(user)}
              class="bg-background"
            />
          </li>
        {/each}
      </ul>
    {:else}
      <div class="flex flex-col items-start gap-1">
        <p class="text-sm">No users found</p>
      </div>
    {/if}
  {/if}
</div>
