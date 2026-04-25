<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { withSeasonParam } from '$lib/util/url';
  import { LoaderCircle } from 'lucide-svelte';
  import type {
    LeaderboardEntryResponse,
    MatchResponse,
  } from '../../api-v3/models';
  import Kpi from './kpi.svelte';
  import MatchCard from './match-card/match-card.svelte';
  import * as Card from './ui/card';

  interface Props {
    entry: LeaderboardEntryResponse;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fetchRecentMatch: (
      leaguePlayerId: string,
      seasonId: string | undefined
    ) => Promise<MatchResponse | null>;
    playerHrefBase: string;
  }

  let {
    entry,
    open,
    onOpenChange,
    fetchRecentMatch,
    playerHrefBase,
  }: Props = $props();

  const seasonId = $derived(page.url.searchParams.get('season') ?? undefined);

  const percentFormatter = new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 0,
  });

  let recentMatchPromise = $derived(
    open ? fetchRecentMatch(entry.leaguePlayerId, seasonId) : null
  );

  const totalGames = $derived(entry.wins + entry.losses);
  const displayName = $derived(entry.displayName ?? entry.username ?? 'Unknown');
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Content class="max-h-screen overflow-y-auto">
    <Dialog.Title class="flex gap-2">{displayName}</Dialog.Title>
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
        <Kpi title="Rank">{entry.mmr != null ? entry.rank : '–'}</Kpi>
        <Kpi title="MMR">{entry.mmr ?? '🐣'}</Kpi>
        <Kpi title="Win %">
          {percentFormatter.format(totalGames > 0 ? entry.wins / totalGames : 0)}
        </Kpi>
        <Kpi title="# Wins" class="col-start-1">{entry.wins}</Kpi>
        <Kpi title="# Losses">{entry.losses}</Kpi>
        <Kpi title="# Matches">{totalGames}</Kpi>
        <Kpi title="Streak">
          {#if entry.winningStreak > 0}🔥 {entry.winningStreak}{/if}
          {#if entry.losingStreak > 0}{entry.losingStreak >= 7 ? '⛈️' : '🌧️'} {entry.losingStreak}{/if}
          {#if entry.winningStreak === 0 && entry.losingStreak === 0}—{/if}
        </Kpi>
      </div>

      <div class="flex flex-col gap-2">
        <p class="text-base text-gray-300">Latest Match</p>
        {#if recentMatchPromise != null}
          {#await recentMatchPromise}
            <Card.Root class="flex items-center gap-2 p-4">
              <LoaderCircle class="text-muted-foreground animate-spin" />
              <p class="text-muted-foreground text-base">
                Fetching latest match...
              </p>
            </Card.Root>
          {:then recentMatch}
            {#if recentMatch}
              <MatchCard match={recentMatch} showMmr />
            {:else}
              <Card.Root class="p-4">
                <p class="text-muted-foreground text-base">No matches yet.</p>
              </Card.Root>
            {/if}
          {:catch error}
            <Card.Root class="flex items-center gap-2 p-4">
              <p class="text-base text-red-500">{error.message ?? error}</p>
            </Card.Root>
          {/await}
        {/if}
      </div>
    </div>
    <Dialog.Footer class="gap-2">
      <Button variant="outline" onclick={() => onOpenChange(false)}>Close</Button>
      <Button
        href={withSeasonParam(`${playerHrefBase}/${entry.leaguePlayerId}`, seasonId)}
      >
        More details
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
