<script lang="ts">
  import clsx from 'clsx';
  import { Check, Pause, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import type { TweakedMatchMakingQueueStatus } from '../../../routes/(authed)/api/matchmaking/status/types';
  import ActiveMatchCard from '../../../routes/(authed)/components/active-match-card.svelte';
  import Button from '../ui/button/button.svelte';
  import type { MatchMakingState } from './types';

  $: matchMakingStatus = { type: 'inactive' } as MatchMakingState;

  let initialSecondsToRespond: number | null = null;

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
      matchMakingStatus = {
        type: 'active-match',
        activeMatch: status.assignedActiveMatch,
      };
    } else if (status?.assignedPendingMatch != null) {
      switch (status.assignedPendingMatch.status) {
        case 'Pending':
          if (
            matchMakingStatus.type === 'pending-match' &&
            matchMakingStatus.pendingMatchId === status.assignedPendingMatch.id
          ) {
            break;
          }
          matchFoundAudio.play();
          matchMakingStatus = {
            type: 'pending-match',
            pendingMatchId: status.assignedPendingMatch.id,
            expiresAt: new Date(status.assignedPendingMatch.expiresAt),
          };
          initialSecondsToRespond = Math.floor(
            (matchMakingStatus.expiresAt.getTime() - Date.now()) / 1000
          );

          break;
        case 'Declined':
          matchMakingStatus = { type: 'inactive' };
          break;
      }
    } else if (status?.isUserInQueue) {
      matchMakingStatus = {
        type: 'queued',
        playersInQueue: status.playersInQueue,
      };
    } else {
      matchMakingStatus = { type: 'inactive' };
    }
  };

  let secondsToRespond = -1;
  onMount(() => {
    let frame: number;
    const updateSecondsToRespond = () => {
      if (
        matchMakingStatus.type === 'pending-match' ||
        matchMakingStatus.type === 'match-accepted'
      ) {
        secondsToRespond = Math.ceil(
          (matchMakingStatus.expiresAt.getTime() - Date.now()) / 1000
        );
      } else {
        secondsToRespond = -1;
      }
      frame = requestAnimationFrame(updateSecondsToRespond);
    };
    frame = requestAnimationFrame(updateSecondsToRespond);
    return () => {
      cancelAnimationFrame(frame);
    };
  });

  const fastRefreshStatusTypes: MatchMakingState['type'][] = [
    'match-accepted',
    'pending-match',
    'queued',
  ];

  onMount(() => {
    refreshQueueStatus();
    const fastIntervalId = setInterval(() => {
      if (fastRefreshStatusTypes.includes(matchMakingStatus.type)) {
        refreshQueueStatus();
      }
    }, 1000);

    const slowIntervalId = setInterval(() => {
      if (!fastRefreshStatusTypes.includes(matchMakingStatus.type)) {
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
    matchMakingStatus = { type: 'inactive' };
  };

  const onAcceptMatch = async () => {
    if (matchMakingStatus.type !== 'pending-match') {
      return;
    }

    const body = new FormData();
    body.append('intent', 'accept');
    body.append('matchId', matchMakingStatus.pendingMatchId);
    await fetch('/api/matchmaking/queue', { method: 'POST', body });
    matchMakingStatus = {
      type: 'match-accepted',
      pendingMatchId: matchMakingStatus.pendingMatchId,
      expiresAt: matchMakingStatus.expiresAt,
    };
  };

  const onDeclineMatch = async () => {
    if (matchMakingStatus.type !== 'pending-match') {
      return;
    }

    const body = new FormData();
    body.append('intent', 'decline');
    body.append('matchId', matchMakingStatus.pendingMatchId);

    await fetch('/api/matchmaking/queue', { method: 'POST', body });
    matchMakingStatus = { type: 'inactive' };
  };

  const matchMakingStatuses: Partial<Record<MatchMakingState['type'], string>> =
    {
      queued: 'Looking for other players...',
      'pending-match': 'Accept or decline the match before time runs out',
      'match-accepted': 'Waiting for other players to accept the match',
      'active-match': 'Now the teams are set. Go play!',
    };

  const matchMakingStatusTitles: Partial<
    Record<MatchMakingState['type'], string>
  > = {
    queued: 'Matchmaking',
    'pending-match': 'Match found!',
    'match-accepted': 'Match accepted!',
    'active-match': 'Match ready!',
  };

  type ModalSize = 'sm' | 'xl';
  const modalSizeForMatchMakingStatus: Record<
    MatchMakingState['type'],
    ModalSize
  > = {
    queued: 'sm',
    'pending-match': 'xl',
    'match-accepted': 'xl',
    'active-match': 'xl',
    inactive: 'sm',
  };
</script>

{#if matchMakingStatus.type !== 'inactive'}
  {#if modalSizeForMatchMakingStatus[matchMakingStatus.type] === 'sm'}
    <div class="fixed bottom-20 left-0 right-0 mx-auto max-w-screen-sm px-4">
      <div
        class={clsx(
          'w-full rounded-2xl border p-5',
          matchMakingStatus.type === 'queued'
            ? 'animate-border border border-transparent [background:linear-gradient(60deg,#001003,theme(colors.orange.950)_60%,#001003)_padding-box,conic-gradient(from_var(--border-angle),theme(colors.orange.600/.58)_80%,_theme(colors.orange.300)_94%,_theme(colors.orange.600/.58))_border-box]'
            : 'border-orange-500 [background:linear-gradient(60deg,#001003,theme(colors.orange.950)_60%,#001003)_padding-box]'
        )}
      >
        <div class="flex items-center justify-between">
          <div>
            <span class="text-xs">Matchmaking</span>
            <p>{matchMakingStatuses[matchMakingStatus.type]}</p>
          </div>
          <div class="flex items-center gap-4">
            {#if matchMakingStatus.type === 'queued'}
              <p class="text-sm">{matchMakingStatus.playersInQueue} / 4</p>
              <Button
                variant="destructive"
                type="submit"
                on:click={onLeaveQueue}><Pause class="mr-2" />Leave</Button
              >
            {:else if matchMakingStatus.type === 'pending-match'}
              <div class="mr-2 text-xl font-bold text-white">
                {Math.max(secondsToRespond, 0)}
              </div>
              <div class="flex gap-2">
                <Button on:click={onAcceptMatch} class="animate-bounce"
                  >Accept</Button
                >
                <Button
                  on:click={onDeclineMatch}
                  variant="destructive"
                  size="icon"><X /></Button
                >
              </div>
            {:else if matchMakingStatus.type === 'match-accepted'}
              <Button disabled>Match accepted</Button>
            {/if}
          </div>
        </div>
        {#if matchMakingStatus.type === 'pending-match' && initialSecondsToRespond != null}
          <div
            style="animation-duration: {initialSecondsToRespond}s"
            class="mt-3 h-4 animate-[min-max-width_0s_linear_forwards] rounded-full bg-gradient-to-r from-orange-700 to-orange-400"
          />
        {/if}
      </div>
    </div>
  {:else if modalSizeForMatchMakingStatus[matchMakingStatus.type] === 'xl'}
    <div class="fixed inset-2 flex items-center justify-center p-4 sm:inset-20">
      <div class="h-full max-h-96 w-full max-w-2xl">
        <div
          class={clsx(
            'size-full rounded-2xl border p-5',
            matchMakingStatus.type === 'queued'
              ? 'animate-border border border-transparent [background:linear-gradient(60deg,#001003,theme(colors.orange.950)_60%,#001003)_padding-box,conic-gradient(from_var(--border-angle),theme(colors.orange.600/.58)_80%,_theme(colors.orange.300)_94%,_theme(colors.orange.600/.58))_border-box]'
              : 'border-orange-500 [background:linear-gradient(60deg,#001003,theme(colors.orange.950)_60%,#001003)_padding-box]'
          )}
        >
          <div class="flex h-full flex-col items-stretch justify-between">
            <p class="self-center text-3xl font-bold">
              {matchMakingStatusTitles[matchMakingStatus.type] ?? 'Matchmaking'}
            </p>
            {#if (matchMakingStatus.type === 'pending-match' || matchMakingStatus.type === 'match-accepted') && initialSecondsToRespond != null}
              <div class="relative h-44 w-44 self-center">
                <svg
                  viewBox="0 0 100 100"
                  class="h-full w-full rotate-[135deg] transform"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke-width="6"
                    stroke-linecap="round"
                    stroke-dasharray="188.5 251.3"
                    class="stroke-muted"
                  />

                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke-width="6"
                    stroke-linecap="round"
                    style="animation-duration: {initialSecondsToRespond}s"
                    class="animate-[progress_0s_linear_forwards] stroke-white"
                  />
                </svg>
                <div
                  class="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pb-4"
                >
                  <span class="text-3xl font-bold text-white"
                    >{Math.max(secondsToRespond, 0)}</span
                  >
                </div>
              </div>
            {/if}
            {#if matchMakingStatus.type === 'active-match'}
              <ActiveMatchCard
                match={matchMakingStatus.activeMatch}
                users={matchMakingStatus.activeMatch.users}
              />
            {/if}
            {#if matchMakingStatuses[matchMakingStatus.type]}
              <p class="self-center text-lg text-gray-400">
                {matchMakingStatuses[matchMakingStatus.type]}
              </p>
            {/if}
            {#if matchMakingStatus.type === 'pending-match'}
              <div class="flex justify-stretch gap-2 sm:gap-4">
                <Button
                  on:click={onDeclineMatch}
                  variant="secondary"
                  class="flex-1 gap-1 text-lg sm:gap-3"><X />Decline</Button
                >
                <Button
                  on:click={onAcceptMatch}
                  class="flex-1 gap-1 text-lg sm:gap-3"><Check /> Accept</Button
                >
              </div>
            {:else if matchMakingStatus.type === 'match-accepted'}
              <Button class="self-center px-8 py-6 text-lg" disabled>
                Match accepted
              </Button>
            {:else if matchMakingStatus.type === 'active-match'}
              <Button
                on:click={() => {
                  matchMakingStatus = { type: 'inactive' };
                }}
                class="self-center px-8 py-6 text-lg">OK!</Button
              >
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  @property --border-angle {
    inherits: false;
    initial-value: 0deg;
    syntax: '<angle>';
  }
</style>
