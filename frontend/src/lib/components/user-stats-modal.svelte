<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { withSeasonParam } from '$lib/util/url';
  import { LoaderCircle } from 'lucide-svelte';
  import type { UserDetails } from '../../api';
  import Kpi from './kpi.svelte';
  import type { RankedLeaderboardEntry } from './leaderboard/leader-board-entry';
  import MatchCard from './match-card/match-card.svelte';
  import * as Card from './ui/card';

  interface Props {
    user: UserDetails;
    users: UserDetails[];
    leaderboardEntry: RankedLeaderboardEntry | null | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

  let { user, users, leaderboardEntry, open, onOpenChange }: Props = $props();

  // TODO: Refactor this to use a store
  const seasonId = $derived(
    page.url.searchParams.get('season')
      ? parseInt(page.url.searchParams.get('season') ?? '')
      : undefined
  );

  const percentFormatter = new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 0,
  });

  const fetchRecentMatch = async (
    userId: number,
    seasonId: number | undefined
  ) => {
    const response = await fetch(
      withSeasonParam(`/api/recent-match?playerId=${userId}`, seasonId)
    );
    if (response.ok) {
      const data = await response.json();
      return data.latestMatch;
    } else {
      throw new Error('Failed to fetch recent match');
    }
  };

  // Fetch recent match every time user changes and store in promise
  let recentMatchPromise = $derived(
    user && user.userId ? fetchRecentMatch(user.userId, seasonId) : null
  );
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Content class="max-h-screen overflow-y-auto">
    <Dialog.Title class="flex gap-2">
      {user.displayName ?? user.name}
    </Dialog.Title>
    <div class="flex flex-col gap-4">
      {#if leaderboardEntry != null}
        {@const totalGamesPlayed =
          (leaderboardEntry.wins ?? 0) + (leaderboardEntry.loses ?? 0)}
        <div class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
          <Kpi title="Rank">{leaderboardEntry.rank}</Kpi>
          <Kpi title="MMR">{leaderboardEntry.mmr ?? '🐣'}</Kpi>
          <Kpi title="Win %">
            {percentFormatter.format(
              totalGamesPlayed > 0
                ? (leaderboardEntry.wins ?? 0) / totalGamesPlayed
                : 0
            )}
          </Kpi>
          <Kpi title="# Wins" class="col-start-1"
            >{leaderboardEntry.wins ?? 0}</Kpi
          >
          <Kpi title="# Losses">{leaderboardEntry.loses ?? 0}</Kpi>
          <Kpi title="# Matches">{totalGamesPlayed}</Kpi>
          <Kpi title="Streak">
            {#if (leaderboardEntry.winningStreak ?? 0) > 0}🔥 {leaderboardEntry.winningStreak}{/if}
            {#if (leaderboardEntry.losingStreak ?? 0) > 0}{leaderboardEntry.losingStreak >=
              7
                ? '⛈️'
                : '🌧️'}
              {leaderboardEntry.losingStreak}{/if}
          </Kpi>
        </div>
      {/if}
      {#if users.length > 0}
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
              <MatchCard match={recentMatch} {users} showMmr />
            {:catch error}
              <Card.Root class="flex items-center gap-2 p-4">
                <p class="text-base text-red-500">
                  {error}
                </p>
              </Card.Root>
            {/await}
          {/if}
        </div>
      {/if}
    </div>
    <Dialog.Footer class="gap-2">
      <Button variant="outline" onclick={() => onOpenChange(false)}
        >Close</Button
      >
      <Button href={withSeasonParam(`/player/${user.userId}`, seasonId)}
        >More details</Button
      >
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
