<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import type { ActiveMatchDto, UserDetails } from '../../../api';

  export let users: UserDetails[];
  export let match: ActiveMatchDto;
  export let highlighted: boolean = false;
  export let team1Score: number | undefined = undefined;
  export let team2Score: number | undefined = undefined;
</script>

<Card.Root class={highlighted ? 'border-primary' : undefined}>
  <div class="flex flex-row items-center gap-1 px-2 py-1 md:px-4 md:py-2">
    <div
      class="flex flex-1 flex-row items-center gap-4"
      class:text-primary={(team1Score ?? 0) > (team2Score ?? 0)}
    >
      <p class="min-w-[1.5ch] text-4xl font-extrabold">
        {#if team1Score != null}{team1Score}{:else}<span class="animate-pulse"
            >?</span
          >{/if}
      </p>
      <div class="flex flex-1 flex-col">
        {#each match.team1.playerIds as playerId}
          {@const user = users.find((user) => user.userId === playerId)}
          <p class="space-x-1">
            {user?.name}
          </p>
        {/each}
      </div>
    </div>
    <div class="flex flex-col items-center">
      vs.
      {#if match.createdAt}
        <p
          class="text-muted-foreground"
          title={new Date(match.createdAt).toDateString()}
        >
          {new Date(match.createdAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      {/if}
    </div>
    <div
      class="flex flex-1 flex-row items-center gap-4"
      class:text-primary={(team2Score ?? 0) > (team1Score ?? 0)}
    >
      <div class="flex flex-1 flex-col items-end">
        {#each match.team2.playerIds as playerId}
          {@const user = users.find((user) => user.userId === playerId)}
          <p class="space-x-1">
            {user?.name}
          </p>
        {/each}
      </div>
      <p class="min-w-[1.5ch] text-right text-4xl font-extrabold">
        {#if team2Score != null}{team2Score}{:else}<span class="animate-pulse"
            >?</span
          >{/if}
      </p>
    </div>
  </div>
</Card.Root>
