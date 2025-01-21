<script lang="ts">
  import type { MatchDetailsV2 } from '../../../api';
  import type { MatchUser } from './match-user';
  import MmrDelta from './mmr-delta.svelte';

  export let match: Pick<MatchDetailsV2, 'mmrCalculations' | 'team1' | 'team2'>;
  export let users: MatchUser[];
  export let showMmr = false;
  export let team: 'team1' | 'team2';
  export let member: 'member1' | 'member2';

  $: memberId = match[team][member];
  $: memberName =
    users.find((user) => user.userId === memberId)?.name ?? 'Unknown';
  $: delta =
    member === 'member1'
      ? match.mmrCalculations?.[team].player1MMRDelta
      : match.mmrCalculations?.[team].player2MMRDelta;

  $: align = team === 'team1' ? 'left' : 'right';
</script>

<p class="space-x-1">
  {#if showMmr && align === 'right'}<MmrDelta {delta} />{/if}<span
    >{memberName}</span
  >{#if showMmr && align === 'left'}<MmrDelta {delta} />{/if}
</p>
