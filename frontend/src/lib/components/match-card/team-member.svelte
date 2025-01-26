<script lang="ts">
  import type { MatchDetailsV2 } from '../../../api';
  import type { MatchUser } from './match-user';
  import MmrDelta from './mmr-delta.svelte';

  interface Props {
    match: Pick<MatchDetailsV2, 'mmrCalculations' | 'team1' | 'team2'>;
    users: MatchUser[];
    showMmr?: boolean;
    team: 'team1' | 'team2';
    member: 'member1' | 'member2';
  }

  let { match, users, showMmr = false, team, member }: Props = $props();

  let memberId = $derived(match[team][member]);
  let memberName = $derived(
    users.find((user) => user.userId === memberId)?.name ?? 'Unknown'
  );
  let delta = $derived(
    member === 'member1'
      ? match.mmrCalculations?.[team].player1MMRDelta
      : match.mmrCalculations?.[team].player2MMRDelta
  );

  let align = $derived(team === 'team1' ? 'left' : 'right');
</script>

<p class="space-x-1">
  {#if showMmr && align === 'right'}<MmrDelta {delta} />{/if}<span
    >{memberName}</span
  >{#if showMmr && align === 'left'}<MmrDelta {delta} />{/if}
</p>
