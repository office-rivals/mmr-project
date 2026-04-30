<script lang="ts">
  import Kpi from '$lib/components/kpi.svelte';
  import MatchCard from '$lib/components/match-card/match-card.svelte';
  import PageTitle from '$lib/components/page-title.svelte';
  import SeasonPicker from '$lib/components/season-picker.svelte';
  import { Alert } from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import LineChart from '$lib/components/ui/line-chart/line-chart.svelte';
  import * as Table from '$lib/components/ui/table';
  import { enhance } from '$app/forms';
  import {
    AlertCircle,
    CheckCircle,
    Flag,
    Handshake,
    Settings,
    Swords,
    Trash2,
    X,
  } from 'lucide-svelte';
  import { SignOutButton } from 'svelte-clerk';
  import type { ActionData, PageData } from './$types';
  import Filter from './components/filter.svelte';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  const winRateFormatter = new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 0,
  });

  let flagDialogOpen = $state(false);
  let flagMatchId = $state('');
  let flagReason = $state('');
  let editingFlagId = $state<string | null>(null);
  let deleteConfirmOpen = $state(false);

  let filteredPlayers: string[] = $state([]);
  const playerName = $derived(
    data.player.displayName ?? data.player.username ?? 'Player'
  );

  const matches = $derived(
    (data.matches ?? []).filter((match) => {
      if (filteredPlayers.length === 0) return true;
      return filteredPlayers.every((id) =>
        match.teams.some((t) => t.players.some((p) => p.leaguePlayerId === id))
      );
    })
  );

  const chartData = $derived(
    data.ratingHistory?.entries?.map((e) => ({
      date: e.recordedAt,
      player: playerName,
      rating: e.mmr,
    })) ?? []
  );

  const profileSuffix = data.isCurrentUser ? ' - You' : '';

  const myFlagForMatch = (matchId: string) =>
    data.myFlags?.find((f: { matchId: string }) => f.matchId === matchId);

  function openFlagDialog(matchId: string) {
    const existing = myFlagForMatch(matchId);
    flagMatchId = matchId;
    if (existing) {
      editingFlagId = existing.id;
      flagReason = existing.reason;
    } else {
      editingFlagId = null;
      flagReason = '';
    }
    flagDialogOpen = true;
  }

  function closeFlagDialog() {
    flagDialogOpen = false;
    flagMatchId = '';
    flagReason = '';
    editingFlagId = null;
  }

  const playerHref = (leaguePlayerId: string) =>
    `/${data.orgSlug}/${data.leagueSlug}/player/${leaguePlayerId}`;

  const findPlayer = (id: string) => data.players.find((p) => p.id === id);
</script>

<div class="flex flex-col gap-6">
  {#if data.player?.displayName}
    <PageTitle>
      {data.player.displayName} ({data.player.username}){profileSuffix}
    </PageTitle>
  {:else}
    <PageTitle>{data.player?.username ?? 'Player'}{profileSuffix}</PageTitle>
  {/if}

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

  {#if data.isCurrentUser}
    <div class="flex justify-end gap-2">
      <Button href="/settings" class="gap-2" variant="outline">
        <Settings size={16} />
        Settings
      </Button>
      <SignOutButton>
        <Button variant="secondary">Logout</Button>
      </SignOutButton>
    </div>
  {/if}

  {#if data.seasons != null && data.seasons.length > 1 && data.currentSeason}
    <div class="self-end">
      <SeasonPicker seasons={data.seasons} currentSeason={data.currentSeason} />
    </div>
  {/if}

  <div class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
    <Kpi title="MMR">{data.stats.mmr ?? '🐣'}</Kpi>
    <Kpi title="# Matches">{data.stats.totalMatches}</Kpi>
    <Kpi title="# Wins">{data.stats.wins}</Kpi>
    <Kpi title="# Losses">{data.stats.lost}</Kpi>
    <Kpi title="Win rate">
      {new Intl.NumberFormat(undefined, {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(data.stats.winrate)}
    </Kpi>
    {#if data.stats.daysSinceLastMatch != null}
      <Kpi title="Last match">
        {new Intl.RelativeTimeFormat(undefined, {
          style: 'narrow',
          numeric: data.stats.daysSinceLastMatch !== 0 ? 'always' : 'auto',
        }).format(data.stats.daysSinceLastMatch, 'day')}
      </Kpi>
    {/if}
    {#if data.stats.winningStreak > 0 || data.stats.losingStreak > 0}
      <Kpi title="Streak">
        {#if data.stats.winningStreak > 0}🔥 {data.stats.winningStreak}{/if}
        {#if data.stats.losingStreak > 0}{data.stats.losingStreak >= 7
            ? '⛈️'
            : '🌧️'}
          {data.stats.losingStreak}{/if}
      </Kpi>
    {/if}
  </div>

  {#if chartData.length > 0}
    <h2 class="-mb-6 mt-6 text-2xl md:text-4xl">Rating over time</h2>
    <LineChart data={chartData} height={300} legend={false} />
  {/if}

  {#if data.opponents.length > 0}
    <Card.Root>
      <Card.Content class="flex flex-col p-0 md:p-6">
        <h2
          class="flex items-center space-x-2 px-4 py-3 text-xl md:p-0 md:text-2xl"
        >
          <Swords /><span>Most common opponents</span>
        </h2>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Player</Table.Head>
              <Table.Head>
                <span class="sm:hidden">W</span>
                <span class="hidden sm:inline">Wins</span>
              </Table.Head>
              <Table.Head>
                <span class="sm:hidden">L</span>
                <span class="hidden sm:inline">Losses</span>
              </Table.Head>
              <Table.Head class="text-right">Win %</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.opponents as opp (opp.leaguePlayerId)}
              <Table.Row>
                <Table.Cell>
                  <a
                    class="hover:underline"
                    href={playerHref(opp.leaguePlayerId)}
                  >
                    <div class="flex flex-col items-start">
                      {#if opp.displayName}
                        <span class="hidden w-full truncate sm:block">
                          {opp.displayName}
                        </span>
                      {/if}
                      <span class="block">
                        {opp.username ?? opp.displayName ?? 'Unknown'}
                      </span>
                    </div>
                  </a>
                </Table.Cell>
                <Table.Cell>{opp.wins}</Table.Cell>
                <Table.Cell>{opp.losses}</Table.Cell>
                <Table.Cell class="text-right">
                  {winRateFormatter.format(
                    opp.total > 0 ? opp.wins / opp.total : 0
                  )}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </Card.Content>
    </Card.Root>
  {/if}

  {#if data.teammates.length > 0}
    <Card.Root>
      <Card.Content class="flex flex-col p-0 md:p-6">
        <h2
          class="flex items-center space-x-2 px-4 py-3 text-xl md:p-0 md:text-2xl"
        >
          <Handshake /><span>Most common teammates</span>
        </h2>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Player</Table.Head>
              <Table.Head>
                <span class="sm:hidden">W</span>
                <span class="hidden sm:inline">Wins</span>
              </Table.Head>
              <Table.Head>
                <span class="sm:hidden">L</span>
                <span class="hidden sm:inline">Losses</span>
              </Table.Head>
              <Table.Head class="text-right">Win %</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.teammates as tm (tm.leaguePlayerId)}
              <Table.Row>
                <Table.Cell>
                  <a
                    class="hover:underline"
                    href={playerHref(tm.leaguePlayerId)}
                  >
                    <div class="flex flex-col items-start">
                      {#if tm.displayName}
                        <span class="hidden w-full truncate sm:block">
                          {tm.displayName}
                        </span>
                      {/if}
                      <span class="block">
                        {tm.username ?? tm.displayName ?? 'Unknown'}
                      </span>
                    </div>
                  </a>
                </Table.Cell>
                <Table.Cell>{tm.wins}</Table.Cell>
                <Table.Cell>{tm.losses}</Table.Cell>
                <Table.Cell class="text-right">
                  {winRateFormatter.format(
                    tm.total > 0 ? tm.wins / tm.total : 0
                  )}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </Card.Content>
    </Card.Root>
  {/if}

  {#if data.matches.length > 0}
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <h2 class="text-2xl md:text-4xl">Matches</h2>
      </div>
      <div class="flex flex-col space-y-2">
        <Filter
          players={data.players ?? []}
          onSelected={(id) => (filteredPlayers = [...filteredPlayers, id])}
        />
        <div class="flex flex-wrap gap-1">
          {#each filteredPlayers as id (id)}
            {@const p = findPlayer(id)}
            {#if p != null}
              <div
                class="flex items-center space-x-2 rounded-md bg-secondary p-2 text-sm text-secondary-foreground"
              >
                <span>{p.displayName ?? p.username ?? 'Unknown'}</span>
                <button
                  onclick={() => {
                    filteredPlayers = filteredPlayers.filter(
                      (pid) => pid !== id
                    );
                  }}
                >
                  <X class="h-4 w-4" />
                </button>
              </div>
            {/if}
          {/each}
        </div>
      </div>
      <div class="flex flex-1 flex-col items-stretch gap-2">
        {#if matches.length === 0}
          <p>No matches found</p>
        {/if}
        {#each matches as match (match.id)}
          {@const existingFlag = myFlagForMatch(match.id)}
          <div class="rounded-lg {existingFlag ? 'ring-1 ring-red-400' : ''}">
            <div class="flex items-stretch gap-1">
              <div class="flex-1">
                <MatchCard {match} showMmr />
              </div>
              <button
                class="rounded p-2 transition-colors hover:bg-muted {existingFlag
                  ? 'text-red-500'
                  : 'text-muted-foreground'}"
                title={existingFlag ? 'Edit flag' : 'Flag this match'}
                onclick={() => openFlagDialog(match.id)}
              >
                <Flag class="h-4 w-4" />
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<Dialog.Root bind:open={flagDialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>
        {editingFlagId ? 'Edit Flag' : 'Flag Match'}
      </Dialog.Title>
      <Dialog.Description>
        {editingFlagId
          ? 'Update or delete your flag for this match.'
          : 'Report an issue with this match.'}
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      {#if editingFlagId}
        <form
          method="POST"
          action="?/updateFlag"
          use:enhance={() => {
            return async ({ result, update }) => {
              await update();
              if (result.type === 'success') closeFlagDialog();
            };
          }}
        >
          <input type="hidden" name="flagId" value={editingFlagId} />
          <input type="hidden" name="orgId" value={data.orgId} />
          <input type="hidden" name="leagueId" value={data.leagueId} />
          <div class="space-y-2">
            <label for="reason" class="text-sm font-medium">Reason</label>
            <textarea
              id="reason"
              name="reason"
              bind:value={flagReason}
              rows="3"
              maxlength="500"
              class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Describe the issue..."
            ></textarea>
            <p class="text-xs text-muted-foreground">
              {flagReason.length}/500
            </p>
          </div>
          <Dialog.Footer class="mt-4 gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onclick={() => (deleteConfirmOpen = true)}
            >
              <Trash2 class="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
            <Button type="button" variant="outline" onclick={closeFlagDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={!flagReason.trim()}>
              Update Flag
            </Button>
          </Dialog.Footer>
        </form>
      {:else}
        <form
          method="POST"
          action="?/flagMatch"
          use:enhance={() => {
            return async ({ result, update }) => {
              await update();
              if (result.type === 'success') closeFlagDialog();
            };
          }}
        >
          <input type="hidden" name="matchId" value={flagMatchId} />
          <input type="hidden" name="orgId" value={data.orgId} />
          <input type="hidden" name="leagueId" value={data.leagueId} />
          <div class="space-y-2">
            <label for="reason" class="text-sm font-medium">Reason</label>
            <textarea
              id="reason"
              name="reason"
              bind:value={flagReason}
              rows="3"
              maxlength="500"
              class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Describe the issue..."
            ></textarea>
            <p class="text-xs text-muted-foreground">
              {flagReason.length}/500
            </p>
          </div>
          <Dialog.Footer class="mt-4 gap-2">
            <Button type="button" variant="outline" onclick={closeFlagDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={!flagReason.trim()}>
              <Flag class="mr-1 h-3.5 w-3.5" />
              Flag Match
            </Button>
          </Dialog.Footer>
        </form>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={deleteConfirmOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Delete Flag</Dialog.Title>
      <Dialog.Description>
        Are you sure you want to delete this flag? This action cannot be undone.
      </Dialog.Description>
    </Dialog.Header>
    <form
      method="POST"
      action="?/deleteFlag"
      use:enhance={() => {
        return async ({ result, update }) => {
          await update();
          if (result.type === 'success') {
            deleteConfirmOpen = false;
            closeFlagDialog();
          }
        };
      }}
    >
      <input type="hidden" name="flagId" value={editingFlagId} />
      <input type="hidden" name="orgId" value={data.orgId} />
      <input type="hidden" name="leagueId" value={data.leagueId} />
      <Dialog.Footer class="gap-2">
        <Button
          type="button"
          variant="outline"
          onclick={() => (deleteConfirmOpen = false)}>Cancel</Button
        >
        <Button type="submit" variant="destructive">Delete Flag</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
