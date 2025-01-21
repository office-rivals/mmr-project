<script lang="ts">
  import type { MatchMakingQueueStatus } from '$api';
  import PageTitle from '$lib/components/page-title.svelte';
  import { Button } from '$lib/components/ui/button';
  import { LoaderCircle, Pause, Play } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  const PLAYERS_REQUIRED_FOR_MATCH = 4;

  let remainingPlayers = data.matchmaking
    ? PLAYERS_REQUIRED_FOR_MATCH - data.matchmaking.playersInQueue
    : undefined;
  let isUserInQueue = data.matchmaking?.isUserInQueue;

  const getQueueStatus = async () => {
    const response = await fetch('/api/matchmaking/status');
    return (await response.json()) as MatchMakingQueueStatus;
  };

  const refreshQueueStatus = async () => {
    if (!isUserInQueue) {
      return;
    }
    const status = await getQueueStatus();
    remainingPlayers = PLAYERS_REQUIRED_FOR_MATCH - status.playersInQueue;
    isUserInQueue = status.isUserInQueue;
  };

  $: queueEligabiltiy = 'notification-unsupported';
  onMount(() => {
    queueEligabiltiy =
      Notification?.permission === 'granted'
        ? 'ready'
        : 'disabled-notifications';

    const intervalId = setInterval(() => {
      refreshQueueStatus();
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  });
</script>

<PageTitle>Matchmaking</PageTitle>

<p class="my-6">
  Matchmaking is a feature where you queue up for a game against other people
  that are also ready for a game. <br />Once {PLAYERS_REQUIRED_FOR_MATCH} players
  are in the queue, a match will be created and you will be notified.
  <br />
  If you do not accept the match within 30 seconds, you will be removed from the
  queue.
</p>
<form method="post">
  {#if isUserInQueue}
    <input type="hidden" name="intent" value="leave" />
    <div class="flex gap-2">
      <LoaderCircle class="animate-spin" />
      <p>Waiting for a match...</p>
    </div>
    <p>Missing {remainingPlayers} more players</p>
    <Button variant="destructive" type="submit">
      <Pause /><span class="ml-2">Leave queue</span>
    </Button>
  {:else if !data.hasClaimedProfile}
    <p>You need to link your login to a player to queue up for a match.</p>
    <Button href="/profile" size="lg" class="w-full py-6 text-xl"
      >Claim profile</Button
    >
  {:else if queueEligabiltiy === 'ready'}
    <input type="hidden" name="intent" value="queue" />
    <Button size="lg" class="w-full py-6" type="submit">
      <Play /><span class="ml-2 text-xl">Queue up</span>
    </Button>
  {:else if queueEligabiltiy === 'notification-unsupported'}
    <p>Your browser does not support notifications.</p>
  {:else}
    <p>
      You need to allow notifications to queue up for a match.
      <Button
        size="lg"
        class="w-full py-6"
        type="button"
        on:click={() =>
          Notification?.requestPermission().then(() => {
            if (Notification.permission === 'granted') {
              queueEligabiltiy = 'ready';
            }
          })}><span class="ml-2 text-xl">Enable notifications</span></Button
      >
    </p>
  {/if}
</form>
