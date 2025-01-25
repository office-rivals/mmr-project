<script lang="ts">
  import { onMount } from 'svelte';
  import type { TweakedMatchMakingQueueStatus } from '../../../routes/(authed)/api/matchmaking/status/types';
  import ActiveMatchState from './active-match-state.svelte';
  import PendingMatchState from './pending-match-state.svelte';
  import QueuedState from './queued-state.svelte';
  import type { MatchMakingState } from './types';

  $: matchMakingState = { type: 'inactive' } as MatchMakingState;

  let matchFoundAudio: HTMLAudioElement;
  onMount(() => {
    matchFoundAudio = new Audio('/sounds/match-found.mp3');
    matchFoundAudio.preload = 'auto';
  });

  const getQueueStatus = async () => {
    const response = await fetch('/api/matchmaking/status');
    return (await response.json()) as TweakedMatchMakingQueueStatus;
  };

  const refreshQueueStatus = async () => {
    const status = await getQueueStatus();
    if (status?.assignedActiveMatch != null) {
      matchMakingState = {
        type: 'active-match',
        activeMatch: status.assignedActiveMatch,
      };
    } else if (status?.assignedPendingMatch != null) {
      switch (status.assignedPendingMatch.status) {
        case 'Pending':
          if (
            matchMakingState.type === 'pending-match' &&
            matchMakingState.pendingMatchId === status.assignedPendingMatch.id
          ) {
            break;
          }
          matchFoundAudio.play();
          matchMakingState = {
            type: 'pending-match',
            pendingMatchId: status.assignedPendingMatch.id,
            expiresAt: new Date(status.assignedPendingMatch.expiresAt),
            hasBeenAccepted: false,
          };

          break;
        case 'Declined':
          matchMakingState = { type: 'inactive' };
          break;
      }
    } else if (status?.isUserInQueue) {
      matchMakingState = {
        type: 'queued',
        playersInQueue: status.playersInQueue,
      };
    } else {
      matchMakingState = { type: 'inactive' };
    }
  };

  const fastRefreshStatusTypes: MatchMakingState['type'][] = [
    'pending-match',
    'queued',
  ];

  onMount(() => {
    refreshQueueStatus();
    const fastIntervalId = setInterval(() => {
      if (fastRefreshStatusTypes.includes(matchMakingState.type)) {
        refreshQueueStatus();
      }
    }, 1000);

    const slowIntervalId = setInterval(() => {
      if (!fastRefreshStatusTypes.includes(matchMakingState.type)) {
        refreshQueueStatus();
      }
    }, 10000);

    return () => {
      clearInterval(fastIntervalId);
      clearInterval(slowIntervalId);
    };
  });

  const onLeaveQueue = async () => {
    const body = new FormData();
    body.append('intent', 'leave');
    await fetch('/api/matchmaking/queue', { method: 'POST', body });
    matchMakingState = { type: 'inactive' };
  };

  const onAcceptMatch = async () => {
    if (matchMakingState.type !== 'pending-match') {
      return;
    }

    const body = new FormData();
    body.append('intent', 'accept');
    body.append('matchId', matchMakingState.pendingMatchId);
    await fetch('/api/matchmaking/queue', { method: 'POST', body });
    matchMakingState = {
      ...matchMakingState,
      hasBeenAccepted: true,
    };
  };

  const onDeclineMatch = async () => {
    if (matchMakingState.type !== 'pending-match') {
      return;
    }

    const body = new FormData();
    body.append('intent', 'decline');
    body.append('matchId', matchMakingState.pendingMatchId);

    await fetch('/api/matchmaking/queue', { method: 'POST', body });
    matchMakingState = { type: 'inactive' };
  };

  const onConfirmedMatch = () => {
    matchMakingState = { type: 'inactive' };
  };
</script>

{#if matchMakingState.type === 'queued'}
  <QueuedState {matchMakingState} {onLeaveQueue} />
{:else if matchMakingState.type === 'pending-match'}
  <PendingMatchState {matchMakingState} {onAcceptMatch} {onDeclineMatch} />
{:else if matchMakingState.type === 'active-match'}
  <ActiveMatchState {matchMakingState} {onConfirmedMatch} />
{/if}
