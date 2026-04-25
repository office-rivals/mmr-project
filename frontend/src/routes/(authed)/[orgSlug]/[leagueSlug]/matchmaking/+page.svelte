<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import { Alert } from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { invalidateAll } from '$app/navigation';
  import {
    AcceptanceStatus,
    type ActiveMatchResponse,
    type PendingMatchResponse,
    type QueueStatusResponse,
  } from '$api3';
  import { LoaderCircle, Pause, Play } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import type { ActionData, PageData } from './$types';

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  const PLAYERS_REQUIRED_FOR_MATCH = 4;

  let queueStatus = $state<QueueStatusResponse | null>(data.queueStatus);
  let activeMatches = $state<ActiveMatchResponse[]>(data.activeMatches ?? []);

  let isInQueue = $derived(
    (queueStatus?.queuedPlayers ?? []).some(
      (p) => p.leaguePlayerId === data.leaguePlayerId
    )
  );
  let playersInQueue = $derived(queueStatus?.queuedPlayers?.length ?? 0);
  let remainingPlayers = $derived(
    Math.max(PLAYERS_REQUIRED_FOR_MATCH - playersInQueue, 0)
  );

  let pendingMatch = $derived(queueStatus?.pendingMatch);
  let pendingForMe = $derived(
    !!pendingMatch &&
      pendingMatch.teams.some((t) =>
        t.players.some((p) => p.leaguePlayerId === data.leaguePlayerId)
      )
  );

  let myAcceptance = $derived(
    pendingMatch?.acceptances.find(
      (a) => a.leaguePlayerId === data.leaguePlayerId
    )
  );

  let now = $state(Date.now());
  let secondsRemaining = $derived(
    pendingMatch
      ? Math.max(
          0,
          Math.ceil((new Date(pendingMatch.expiresAt).getTime() - now) / 1000)
        )
      : 0
  );

  let lastPendingMatchId: string | null = null;

  const refreshQueue = async () => {
    const response = await fetch(
      `/api/v3/organizations/${data.orgId}/leagues/${data.leagueId}/queue`
    );
    if (response.ok) {
      queueStatus = await response.json();
    }

    // If a new pending match appeared and we're a participant, ding.
    const id = queueStatus?.pendingMatch?.id ?? null;
    const me = queueStatus?.pendingMatch?.teams.some((t) =>
      t.players.some((p) => p.leaguePlayerId === data.leaguePlayerId)
    );
    if (id && id !== lastPendingMatchId && me) {
      try {
        const audio = new Audio('/sounds/match-found.mp3');
        await audio.play();
      } catch {
        // Autoplay may be blocked; ignore.
      }
    }
    lastPendingMatchId = id;

    // If pending match was accepted by all, the active match list will populate.
    if (queueStatus?.activeMatch) {
      // Refresh full page state so the active match dialog/redirect can fire.
      await invalidateAll();
    }
  };

  onMount(() => {
    lastPendingMatchId = pendingMatch?.id ?? null;
    const ticker = setInterval(() => (now = Date.now()), 250);
    const poller = setInterval(refreshQueue, 2000);
    return () => {
      clearInterval(ticker);
      clearInterval(poller);
    };
  });
</script>

<PageTitle>Matchmaking</PageTitle>

{#if form?.message}
  <Alert variant="destructive">{form.message}</Alert>
{/if}

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

  {#if !data.hasLeaguePlayer}
    <p>You need to join this league before you can queue for matches.</p>
  {:else if isInQueue}
    <div class="flex gap-2">
      <LoaderCircle class="animate-spin" />
      <p>Waiting for a match...</p>
    </div>
    <p>Missing {remainingPlayers} more players</p>
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
    <h2 class="mt-4 text-2xl">Active matches</h2>
    {#each activeMatches as match (match.id)}
      <div class="bg-card rounded-lg border p-4">
        <div class="flex items-center justify-around gap-2">
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

<Dialog.Root open={pendingForMe} onOpenChange={() => {}}>
  <Dialog.Content
    class="sm:max-w-md"
    onInteractOutside={(e) => e.preventDefault()}
    onEscapeKeydown={(e) => e.preventDefault()}
  >
    <Dialog.Header>
      <Dialog.Title>Match found!</Dialog.Title>
      <Dialog.Description>
        Accept within {secondsRemaining}s
      </Dialog.Description>
    </Dialog.Header>

    {#if pendingMatch}
      <div class="space-y-3">
        {#each pendingMatch.teams as team, idx (team.index)}
          <div class="flex flex-col gap-1">
            <p class="text-sm text-muted-foreground">Team {idx + 1}</p>
            {#each team.players as player}
              {@const acc = pendingMatch.acceptances.find(
                (a) => a.leaguePlayerId === player.leaguePlayerId
              )}
              <div class="flex justify-between text-sm">
                <span>{player.displayName ?? player.username ?? 'Unknown'}</span>
                <span class="text-xs text-muted-foreground">
                  {#if acc?.status === AcceptanceStatus.Accepted}
                    ✅ accepted
                  {:else if acc?.status === AcceptanceStatus.Declined}
                    ❌ declined
                  {:else}
                    ⌛ pending
                  {/if}
                </span>
              </div>
            {/each}
          </div>
        {/each}
      </div>

      <div class="mt-4 flex gap-2">
        {#if myAcceptance?.status === AcceptanceStatus.Pending}
          <form method="post" action="?/accept" class="flex-1">
            <input type="hidden" name="orgId" value={data.orgId} />
            <input type="hidden" name="leagueId" value={data.leagueId} />
            <input type="hidden" name="matchId" value={pendingMatch.id} />
            <Button type="submit" class="w-full">Accept</Button>
          </form>
          <form method="post" action="?/decline" class="flex-1">
            <input type="hidden" name="orgId" value={data.orgId} />
            <input type="hidden" name="leagueId" value={data.leagueId} />
            <input type="hidden" name="matchId" value={pendingMatch.id} />
            <Button type="submit" variant="destructive" class="w-full">
              Decline
            </Button>
          </form>
        {:else if myAcceptance?.status === AcceptanceStatus.Accepted}
          <p class="flex-1 text-sm">Waiting for other players...</p>
        {:else}
          <p class="flex-1 text-sm text-muted-foreground">
            Acceptance recorded.
          </p>
        {/if}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
