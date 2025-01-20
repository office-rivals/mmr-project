<script lang="ts">
  import type { MatchMakingQueueStatus } from '$api';
  import clsx from 'clsx';
  import { Pause, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import Button from '../ui/button/button.svelte';

  type MatchMakingStatus =
    | { type: 'queued' }
    | { type: 'inactive' }
    | { type: 'pending-match'; matchId: string; expiresAt: Date };
  $: matchMakingStatus = { type: 'inactive' } as MatchMakingStatus;

  $: secondsToRespond =
    matchMakingStatus.type === 'pending-match'
      ? Math.floor((matchMakingStatus.expiresAt.getTime() - Date.now()) / 1000)
      : 0;

  const getQueueStatus = async () => {
    const response = await fetch('/api/matchmaking/status');
    return (await response.json()) as MatchMakingQueueStatus;
  };

  const refreshQueueStatus = async () => {
    const status = await getQueueStatus();
    if (status?.assignedPendingMatch != null) {
      matchMakingStatus = {
        type: 'pending-match',
        matchId: status.assignedPendingMatch.id,
        expiresAt: new Date(status.assignedPendingMatch.expiresAt),
      };
    } else if (status?.isUserInQueue) {
      matchMakingStatus = { type: 'queued' };
    } else {
      matchMakingStatus = { type: 'inactive' };
    }

    setTimeout(
      async () => {
        await refreshQueueStatus();
      },
      matchMakingStatus.type === 'pending-match' ? 1000 : 3000
    );
  };

  onMount(async () => {
    await refreshQueueStatus();
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
    // TODO When the user is in an active match, show those details - and don't allow him to queue up before entering results
    matchMakingStatus = { type: 'inactive' };
  };

  const onRejectMatch = async () => {
    if (matchMakingStatus.type !== 'pending-match') {
      return;
    }

    const body = new FormData();
    body.append('intent', 'reject');
    body.append('matchId', matchMakingStatus.matchId);

    await fetch('/api/matchmaking/queue', { method: 'POST', body });
    matchMakingStatus = { type: 'inactive' };
  };

  const matchMakingStatuses = {
    queued: 'Looking for other players...',
    'pending-match': 'Match found! Accept the match to start the game.',
  };
</script>

{#if matchMakingStatus.type !== 'inactive'}
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
        <div>
          {#if matchMakingStatus.type === 'queued'}
            <Button variant="destructive" type="submit" on:click={onLeaveQueue}
              ><Pause class="mr-2" />Leave</Button
            >
          {:else if matchMakingStatus.type === 'pending-match'}
            <Button on:click={onAcceptMatch} class="animate-bounce"
              >Accept</Button
            >
            <Button on:click={onRejectMatch} variant="destructive" size="icon"
              ><X /></Button
            >
          {/if}
        </div>
      </div>
      {#if matchMakingStatus.type === 'pending-match'}
        <div
          class="mt-3 h-4 animate-[min-max-width_{secondsToRespond}s_linear_forwards] bg-gradient-to-r from-orange-700 to-orange-400"
        />
      {/if}
    </div>
  </div>
{/if}

<style>
  @property --border-angle {
    inherits: false;
    initial-value: 0deg;
    syntax: '<angle>';
  }
</style>
