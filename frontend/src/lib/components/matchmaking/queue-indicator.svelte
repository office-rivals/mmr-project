<script lang="ts">
  import type { MatchMakingQueueStatus } from '$api';
  import { Pause } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import Button from '../ui/button/button.svelte';

  type MatchMakingStatus = 'queued' | 'inactive';
  $: matchMakingStatus = 'inactive' as MatchMakingStatus;

  onMount(async () => {
    const status = (await fetch('/api/matchmaking/status').then((res) =>
      res.json()
    )) as MatchMakingQueueStatus;
    if (status?.isUserInQueue) {
      matchMakingStatus = 'queued';
    }
  });

  const onLeaveQueue = async () => {
    const body = new FormData();
    body.append('intent', 'leave');
    await fetch('/api/matchmaking/queue', { method: 'POST', body });
    matchMakingStatus = 'inactive';
  };

  const matchMakingStatuses = {
    queued: 'Waiting for a match...',
    inactive: 'Not in queue',
  };
</script>

{#if matchMakingStatus !== 'inactive'}
  <div class="fixed bottom-20 left-0 right-0 mx-auto max-w-screen-sm px-4">
    <div
      class="animate-border w-full rounded-2xl border border-transparent p-5 [background:linear-gradient(60deg,#001003,theme(colors.orange.950)_60%,#001003)_padding-box,conic-gradient(from_var(--border-angle),theme(colors.orange.600/.58)_80%,_theme(colors.orange.300)_94%,_theme(colors.orange.600/.58))_border-box]"
    >
      <div class="flex items-center justify-between">
        <div>
          <span class="text-xs">Matchmaking</span>
          <p>{matchMakingStatuses[matchMakingStatus]}</p>
        </div>
        <Button variant="destructive" on:click={onLeaveQueue}
          ><Pause class="mr-2" />Leave</Button
        >
      </div>
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
