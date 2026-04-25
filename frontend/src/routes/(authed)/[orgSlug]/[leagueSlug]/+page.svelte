<script lang="ts">
  import Leaderboard from '$lib/components/leaderboard/leaderboard.svelte';
  import MatchCard from '$lib/components/match-card/match-card.svelte';
  import PageTitle from '$lib/components/page-title.svelte';
  import ReportMatchModal from '$lib/components/report-match-modal.svelte';
  import SeasonPicker from '$lib/components/season-picker.svelte';
  import UserStatsModal from '$lib/components/user-stats-modal.svelte';
  import { Alert } from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import Label from '$lib/components/ui/label/label.svelte';
  import { showMmr } from '../../../../stores/show-mmr';
  import { Checkbox } from 'bits-ui';
  import {
    AlertCircle,
    Check,
    CheckCircle,
    Flag,
    Minus,
  } from 'lucide-svelte';
  import type {
    LeaderboardEntryResponse,
    LeagueRatingHistoryEntry,
    MatchResponse,
  } from '$api3/models';
  import type { ActionData, PageData } from './$types';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  let statsModalOpen = $state(false);
  let selectedEntry = $state<LeaderboardEntryResponse | null>(null);
  let reportModalOpen = $state(false);
  let ratingHistory = $state<LeagueRatingHistoryEntry[] | undefined>(undefined);

  $effect(() => {
    data.ratingHistoryPromise.then((res) => (ratingHistory = res.entries));
  });

  function openStatsModal(entry: LeaderboardEntryResponse) {
    selectedEntry = entry;
    statsModalOpen = true;
  }

  async function fetchRecentMatch(
    leaguePlayerId: string,
    seasonId: string | undefined
  ): Promise<MatchResponse | null> {
    const params = new URLSearchParams({ leaguePlayerId });
    if (seasonId) params.set('season', seasonId);
    const res = await fetch(
      `/${data.orgSlug}/${data.leagueSlug}/api/recent-match?${params}`
    );
    if (!res.ok) throw new Error('Failed to fetch recent match');
    const body = await res.json();
    return body.match;
  }

</script>

<div class="flex flex-col gap-4">
  <PageTitle>Leaderboard</PageTitle>

  {#if form?.success && form.message}
    <Alert variant="default">
      <div class="flex items-center gap-2">
        <CheckCircle class="h-4 w-4" />
        <span class="font-medium">{form.message}</span>
      </div>
    </Alert>
  {:else if form?.success === false}
    <Alert variant="destructive">
      <div class="flex items-center gap-2">
        <AlertCircle class="h-4 w-4" />
        <span class="font-medium">{form?.message}</span>
      </div>
    </Alert>
  {/if}

  {#if data.seasons != null && data.seasons.length > 1 && data.currentSeason}
    <div class="self-end">
      <SeasonPicker seasons={data.seasons} currentSeason={data.currentSeason} />
    </div>
  {/if}

  <div class="flex">
    <div class="flex flex-1 items-center gap-3">
      <h2 class="text-2xl md:text-4xl">Recent Matches</h2>
      {#if data.leaguePlayerId && data.isCurrentSeason}
        <Button
          variant="outline"
          size="sm"
          onclick={() => (reportModalOpen = true)}
        >
          <Flag class="mr-1.5 h-4 w-4" />
          Report match
        </Button>
      {/if}
    </div>
    <div class="flex items-center space-x-3 self-center">
      <Label id="show-mmr-label" for="show-mmr">MMR:</Label>
      <Checkbox.Root
        bind:checked={$showMmr}
        id="show-mmr"
        class="border-muted bg-primary active:scale-98 data-[state=unchecked]:border-border-input data-[state=unchecked]:hover:border-dark-40 peer inline-flex size-[25px] items-center justify-center rounded-md border transition-all duration-150 ease-in-out data-[state=unchecked]:bg-white"
      >
        {#snippet children({ checked, indeterminate })}
          {#if checked}
            <Check class="text-primary-foreground size-[15px] font-bold" />
          {:else if indeterminate}
            <Minus class="size-[15px] font-bold" />
          {/if}
        {/snippet}
      </Checkbox.Root>
    </div>
  </div>

  <div class="flex flex-1 flex-col items-stretch gap-2">
    {#each data.recentMatches ?? [] as match (match.id)}
      <MatchCard {match} showMmr={$showMmr} />
    {/each}
  </div>

  <h2 class="text-2xl md:text-4xl">Leaderboard</h2>
  <Leaderboard
    entries={data.leaderboard?.entries ?? []}
    {ratingHistory}
    onSelect={openStatsModal}
    currentLeaguePlayerId={data.leaguePlayerId}
  />
</div>

{#if selectedEntry}
  <UserStatsModal
    entry={selectedEntry}
    open={statsModalOpen}
    onOpenChange={(o) => (statsModalOpen = o)}
    {fetchRecentMatch}
    playerHrefBase={`/${data.orgSlug}/${data.leagueSlug}/player`}
  />
{/if}

{#if data.leaguePlayerId && data.isCurrentSeason}
  <ReportMatchModal
    bind:open={reportModalOpen}
    orgId={data.orgId}
    leagueId={data.leagueId}
    seasonId={data.currentSeason?.id}
    leaguePlayerId={data.leaguePlayerId}
    userFlags={data.myFlags ?? []}
  />
{/if}
