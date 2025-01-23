<script lang="ts">
  import type { MatchMakingQueueStatus } from '$api';
  import clsx from 'clsx';
  import { Pause, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import Button from '../ui/button/button.svelte';

  type MatchMakingStatus =
    | { type: 'queued'; playersInQueue: number }
    | { type: 'inactive' }
    | { type: 'pending-match'; matchId: string; expiresAt: Date }
    | { type: 'match-accepted'; matchId: string };
  $: matchMakingStatus = { type: 'inactive' } as MatchMakingStatus;

  let acceptedMatchId: string | null = null;

  let initialSecondsToRespond: number | null = null;

  let matchFoundAudio: HTMLAudioElement;
  onMount(() => {
    matchFoundAudio = new Audio('/sounds/match-found.mp3');
    matchFoundAudio.preload = 'auto';
  });

  const getQueueStatus = async () => {
    const response = await fetch('/api/matchmaking/status');
    return (await response.json()) as MatchMakingQueueStatus;
  };

  const refreshQueueStatus = async () => {
    const status = await getQueueStatus();
    if (status?.assignedPendingMatch != null) {
      switch (status.assignedPendingMatch.status) {
        case 'Pending':
          if (
            matchMakingStatus.type === 'pending-match' &&
            matchMakingStatus.matchId === status.assignedPendingMatch.id
          ) {
            break;
          }
          matchFoundAudio.play();
          matchMakingStatus = {
            type: 'pending-match',
            matchId: status.assignedPendingMatch.id,
            expiresAt: new Date(status.assignedPendingMatch.expiresAt),
          };
          initialSecondsToRespond = Math.floor(
            (matchMakingStatus.expiresAt.getTime() - Date.now()) / 1000
          );
          break;
        case 'Accepted':
          if (matchMakingStatus.type === 'inactive') {
            break;
          }
          matchMakingStatus = {
            type: 'match-accepted',
            matchId: status.assignedPendingMatch.id,
          };
          setTimeout(async () => {
            matchMakingStatus = { type: 'inactive' };
          }, 5000);
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

  let secondsToRespond = 0;

  onMount(() => {
    let frame: number;
    const updateSecondsToRespond = () => {
      if (matchMakingStatus.type === 'pending-match') {
        secondsToRespond = Math.max(
          Math.floor(
            (matchMakingStatus.expiresAt.getTime() - Date.now()) / 1000
          ),
          0
        );
      } else {
        secondsToRespond = 0;
      }
      frame = requestAnimationFrame(updateSecondsToRespond);
    };
    frame = requestAnimationFrame(updateSecondsToRespond);
    return () => {
      cancelAnimationFrame(frame);
    };
  });

  const fastRefreshStatusTypes: MatchMakingStatus['type'][] = [
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
    body.append('matchId', matchMakingStatus.matchId);
    await fetch('/api/matchmaking/queue', { method: 'POST', body });
    acceptedMatchId = matchMakingStatus.matchId;
  };

  const onDeclineMatch = async () => {
    if (matchMakingStatus.type !== 'pending-match') {
      return;
    }

    const body = new FormData();
    body.append('intent', 'decline');
    body.append('matchId', matchMakingStatus.matchId);

    await fetch('/api/matchmaking/queue', { method: 'POST', body });
    matchMakingStatus = { type: 'inactive' };
  };

  const matchMakingStatuses = {
    queued: 'Looking for other players...',
    'pending-match': 'Match found! Accept the match to start the game.',
    'match-accepted': 'Match accepted! Go go go!',
  };

  type ModalSize = 'sm' | 'xl';
  const modalSizeForMatchMakingStatus: Record<
    MatchMakingStatus['type'],
    ModalSize
  > = {
    queued: 'sm',
    'pending-match': 'xl',
    'match-accepted': 'xl',
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
              {#if acceptedMatchId === matchMakingStatus.matchId}
                <Button disabled>Match accepted</Button>
              {:else}
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
              {/if}
            {:else if matchMakingStatus.type === 'match-accepted'}
              <Button
                on:click={() => {
                  matchMakingStatus = { type: 'inactive' };
                }}>OK!</Button
              >
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
    <div class="fixed inset-20 flex items-center justify-center p-4">
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
            <div class="flex flex-col items-start gap-4">
              <span class="text-lg">Matchmaking</span>
              <p class="text-xl">
                {matchMakingStatuses[matchMakingStatus.type]}
              </p>
            </div>
            {#if matchMakingStatus.type === 'pending-match' && initialSecondsToRespond != null}
              <div class="relative h-40 w-40 self-center">
                <svg
                  viewBox="0 0 100 100"
                  class="h-full w-full rotate-[135deg] transform"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke-width="8"
                    stroke-linecap="round"
                    stroke-dasharray="188.5 251.3"
                    class="stroke-muted"
                  />

                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke-width="8"
                    stroke-linecap="round"
                    stroke-dasharray={`${188.5 * ((secondsToRespond - 1) / initialSecondsToRespond)} 251.3`}
                    style="transition: stroke-dasharray 1s linear"
                    class="stroke-primary"
                    class:opacity-0={secondsToRespond === 0}
                  />
                </svg>

                <div
                  class="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pb-4"
                >
                  <span class="text-3xl font-bold text-white"
                    >{secondsToRespond}</span
                  >
                </div>
              </div>
            {/if}
            <div class="flex flex-col items-center gap-4">
              {#if matchMakingStatus.type === 'pending-match'}
                {#if acceptedMatchId === matchMakingStatus.matchId}
                  <Button class="px-8 py-6 text-lg" disabled
                    >Match accepted</Button
                  >
                {:else}
                  <div class="flex gap-2">
                    <Button
                      on:click={onAcceptMatch}
                      class="animate-bounce px-8 py-6 text-lg">Accept</Button
                    >
                    <Button
                      on:click={onDeclineMatch}
                      variant="destructive"
                      class="px-8 py-6 text-lg">Decline</Button
                    >
                  </div>
                {/if}
              {:else if matchMakingStatus.type === 'match-accepted'}
                <Button
                  on:click={() => {
                    matchMakingStatus = { type: 'inactive' };
                  }}
                  class="px-8 py-6 text-lg">OK!</Button
                >
              {/if}
            </div>
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
