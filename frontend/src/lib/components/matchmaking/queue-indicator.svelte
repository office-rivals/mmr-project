<script lang="ts">
  import type { MatchMakingQueueStatus } from '$api';
  import clsx from 'clsx';
  import { Pause, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import Button from '../ui/button/button.svelte';

  type MatchMakingStatus = 'queued' | 'inactive' | 'pending-match';
  $: matchMakingStatus = 'inactive' as MatchMakingStatus;

  const SECONDS_TO_ACCEPT_MATCH = 30;

  onMount(async () => {
    const status = (await fetch('/api/matchmaking/status').then((res) =>
      res.json()
    )) as MatchMakingQueueStatus;
    if (status?.isUserInQueue) {
      matchMakingStatus = 'queued';
    }

    setTimeout(() => {
      // TODO replace with long polling
      if (matchMakingStatus === 'queued') {
        matchMakingStatus = 'pending-match';
      }
    }, 3000);
  });

  const onLeaveQueue = async () => {
    const body = new FormData();
    body.append('intent', 'leave');
    await fetch('/api/matchmaking/queue', { method: 'POST', body });
    matchMakingStatus = 'inactive';
  };

  const onAcceptMatch = async () => {
    const body = new FormData();
    body.append('intent', 'accept');
    body.append('matchId', '1234'); // TODO get the match ID from the server
    await fetch('/api/matchmaking/queue', { method: 'POST', body });
    // TODO When the user is in an active match, show those details - and don't allow him to queue up before entering results
    matchMakingStatus = 'inactive';
  };

  const onRejectMatch = async () => {
    const body = new FormData();
    body.append('intent', 'reject');
    await fetch('/api/matchmaking/queue', { method: 'POST', body });
    matchMakingStatus = 'inactive';
  };

  const matchMakingStatuses = {
    queued: 'Looking for other players...',
    'pending-match': 'Match found! Accept the match to start the game.',
  };
</script>

{#if matchMakingStatus !== 'inactive'}
  <div class="fixed bottom-20 left-0 right-0 mx-auto max-w-screen-sm px-4">
    <div
      class={clsx(
        'w-full rounded-2xl border p-5',
        matchMakingStatus === 'queued'
          ? 'animate-border border border-transparent [background:linear-gradient(60deg,#001003,theme(colors.orange.950)_60%,#001003)_padding-box,conic-gradient(from_var(--border-angle),theme(colors.orange.600/.58)_80%,_theme(colors.orange.300)_94%,_theme(colors.orange.600/.58))_border-box]'
          : 'border-orange-500 [background:linear-gradient(60deg,#001003,theme(colors.orange.950)_60%,#001003)_padding-box]'
      )}
    >
      <div class="flex items-center justify-between">
        <div>
          <span class="text-xs">Matchmaking</span>
          <p>{matchMakingStatuses[matchMakingStatus]}</p>
        </div>
        <div>
          {#if matchMakingStatus === 'queued'}
            <Button variant="destructive" type="submit" on:click={onLeaveQueue}
              ><Pause class="mr-2" />Leave</Button
            >
          {:else if matchMakingStatus === 'pending-match'}
            <Button on:click={onAcceptMatch} class="animate-bounce"
              >Accept</Button
            >
            <Button on:click={onRejectMatch} variant="destructive" size="icon"
              ><X /></Button
            >
          {/if}
        </div>
      </div>
      {#if matchMakingStatus === 'pending-match'}
        <div
          class="mt-3 h-4 animate-[min-max-width_{SECONDS_TO_ACCEPT_MATCH}s_linear_forwards] bg-gradient-to-r from-orange-700 to-orange-400"
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
