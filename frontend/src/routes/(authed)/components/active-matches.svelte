<script lang="ts">
  import type { ActiveMatchDto, UserDetails } from '$api';
  import { X } from 'lucide-svelte';
  import ActiveMatchCard from './active-match-card.svelte';

  export let users: UserDetails[];
  export let activeMatches: ActiveMatchDto[];

  let isExpanded = false;
</script>

{#if activeMatches.length > 0}
  <div class="fixed bottom-20 right-4">
    {#if !isExpanded}
      <button
        class="bg-background flex items-center gap-4 rounded-md border p-4 shadow-md"
        on:click={() => (isExpanded = true)}
      >
        <div>Active matches</div>
        <div
          class="bg-secondary flex aspect-square items-center justify-center rounded-full border px-3"
        >
          {activeMatches.length}
        </div>
      </button>
    {:else}
      <div
        class="bg-background flex min-w-[400px] max-w-[30vw] flex-col gap-4 rounded-md border p-4 shadow-md"
      >
        <div class="flex items-center justify-between">
          <h3>Active Matches</h3>
          <button
            class="text-primary underline"
            on:click={() => (isExpanded = false)}
          >
            <X class="h-4 w-4" />
            <span class="sr-only">Close</span>
          </button>
        </div>
        <hr class="border-t-1 h-0" />
        {#each activeMatches as match}
          <ActiveMatchCard {match} users={users ?? []} />
        {/each}
      </div>
    {/if}
  </div>
{/if}
