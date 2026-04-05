<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import { Button } from '$lib/components/ui/button';
  import type { ActiveMatchResponse, QueueStatusResponse } from '$api3';
  import { LoaderCircle, Pause, Play } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let queueStatus = $state<QueueStatusResponse | null>(data.queueStatus);
  let activeMatches = $state<ActiveMatchResponse[]>(data.activeMatches ?? []);
  let isInQueue = $derived(
    (queueStatus?.queuedPlayers ?? []).some(
      (player) => player.leaguePlayerId === data.leaguePlayerId
    )
  );
  let playersInQueue = $derived((queueStatus?.queuedPlayers ?? []).length);

  const refreshQueue = async () => {
    const response = await fetch(
      `/api/v3/organizations/${data.orgId}/leagues/${data.leagueId}/queue`
    );
    if (response.ok) {
      queueStatus = await response.json();
    }
  };

  onMount(() => {
    const intervalId = setInterval(refreshQueue, 3000);
    return () => clearInterval(intervalId);
  });
</script>

<PageTitle>Matchmaking</PageTitle>

<div class="mt-6 flex flex-col gap-4">
  <p>
    Queue up for a match. Once enough players are in the queue, a match will be
    created automatically.
  </p>
  <p>
    Players in queue: <strong>{playersInQueue}</strong>
  </p>

  {#if !data.hasLeaguePlayer}
    <p>You need to join this league before you can queue for matches.</p>
  {:else if isInQueue}
    <div class="flex gap-2">
      <LoaderCircle class="animate-spin" />
      <p>Waiting for a match...</p>
    </div>
    <form method="post" action="?/leave">
      <input type="hidden" name="orgId" value={data.orgId} />
      <input type="hidden" name="leagueId" value={data.leagueId} />
      <Button variant="destructive" type="submit" class="w-full">
        <Pause /><span class="ml-2">Leave queue</span>
      </Button>
    </form>
  {:else}
    <form method="post" action="?/join">
      <input type="hidden" name="orgId" value={data.orgId} />
      <input type="hidden" name="leagueId" value={data.leagueId} />
      <Button size="lg" class="w-full py-6" type="submit">
        <Play /><span class="ml-2 text-xl">Queue up</span>
      </Button>
    </form>
  {/if}

  {#if activeMatches.length > 0}
    <h2 class="mt-4 text-2xl">Active Matches</h2>
    {#each activeMatches as match}
      <div class="bg-card rounded-lg border p-4">
        <div class="flex items-center justify-between">
          {#each match.teams ?? [] as team}
            <div class="flex flex-col items-center gap-1">
              {#each team.players ?? [] as player}
                <span>{player.displayName ?? player.username ?? 'Unknown'}</span>
              {/each}
            </div>
          {/each}
        </div>
        <div class="mt-2 flex justify-center">
          <Button
            href="/{data.orgSlug}/{data.leagueSlug}/active-match/{match.id}"
            variant="outline"
            size="sm"
          >
            Submit Result
          </Button>
        </div>
      </div>
    {/each}
  {/if}
</div>
