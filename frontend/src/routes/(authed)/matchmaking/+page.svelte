<script lang="ts">
  import type { MatchMakingQueueStatus } from '$api';
  import PageTitle from '$lib/components/page-title.svelte';
  import { Button } from '$lib/components/ui/button';
  import { LoaderCircle, Pause, Play } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const PLAYERS_REQUIRED_FOR_MATCH = 4;

  let remainingPlayers = $state(
    data.matchmaking
      ? PLAYERS_REQUIRED_FOR_MATCH - data.matchmaking.playersInQueue
      : undefined
  );
  let isUserInQueue = $state(data.matchmaking?.isUserInQueue);

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

  onMount(() => {
    const intervalId = setInterval(() => {
      refreshQueueStatus();
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  });
</script>

<PageTitle>Matchmaking</PageTitle>

<div class="mt-6 flex flex-col gap-4">
  <p>
    Matchmaking is a feature where you queue up for a game against other people
    that are also ready for a game.
  </p>
  <p>
    Once <strong>{PLAYERS_REQUIRED_FOR_MATCH} players</strong> are in the queue,
    a match will be created and you will be notified.
  </p>
  <p>
    If you do not accept the match within <strong>30 seconds</strong>, you will
    be removed from the queue.
  </p>
  <p>A sound will play when a match is found.</p>
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
    {:else}
      <input type="hidden" name="intent" value="queue" />
      <Button size="lg" class="w-full py-6" type="submit">
        <Play /><span class="ml-2 text-xl">Queue up</span>
      </Button>
    {/if}
  </form>
</div>
