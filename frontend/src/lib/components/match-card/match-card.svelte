<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Flag } from 'lucide-svelte';
  import type { MatchDetailsV2 } from '../../../api';
  import type { MatchUser } from './match-user';
  import TeamMember from './team-member.svelte';
  import FlagMatchDialog from '../flag-match-dialog.svelte';

  interface Props {
    users: MatchUser[];
    match: Omit<MatchDetailsV2, 'date'> & {
      date?: Date | string;
    };
    showMmr: boolean;
    showFlagButton?: boolean;
  }

  let { users, match, showMmr, showFlagButton = false }: Props = $props();

  let dialogOpen = $state(false);
</script>

<Card.Root>
  <div class="flex flex-row items-center gap-1 px-2 py-1 md:px-4 md:py-2">
    <div
      class="flex flex-1 flex-row items-center gap-4"
      class:text-primary={match.team1.score === 10}
    >
      <p class="min-w-[1.5ch] text-4xl font-extrabold">
        {match.team1.score === 0 ? '🥚' : match.team1.score}
      </p>
      <div class="flex flex-1 flex-col items-start">
        <TeamMember {users} {match} {showMmr} team="team1" member="member1" />
        <TeamMember {users} {match} {showMmr} team="team1" member="member2" />
      </div>
    </div>
    <div class="flex flex-col items-center">
      vs.
      {#if match.date}
        <p
          class="text-muted-foreground"
          title={new Date(match.date).toDateString()}
        >
          {new Date(match.date).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      {/if}
    </div>
    <div
      class="flex flex-1 flex-row items-center gap-4"
      class:text-primary={match.team2.score === 10}
    >
      <div class="flex flex-1 flex-col items-end">
        <TeamMember {users} {match} {showMmr} team="team2" member="member1" />
        <TeamMember {users} {match} {showMmr} team="team2" member="member2" />
      </div>
      <p class="min-w-[1.5ch] text-right text-4xl font-extrabold">
        {match.team2.score === 0 ? '🥚' : match.team2.score}
      </p>
    </div>
    {#if showFlagButton}
      <div class="ml-2">
        <Button
          variant="ghost"
          size="sm"
          onclick={() => (dialogOpen = true)}
          title="Flag this match"
        >
          <Flag class="h-4 w-4" />
        </Button>
      </div>
    {/if}
  </div>
</Card.Root>

{#if showFlagButton}
  <FlagMatchDialog {match} bind:open={dialogOpen} />
{/if}
