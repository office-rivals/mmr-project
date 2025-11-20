<script lang="ts">
  import Kpi from '$lib/components/kpi.svelte';
  import { MatchCard } from '$lib/components/match-card';
  import PageTitle from '$lib/components/page-title.svelte';
  import SeasonPicker from '$lib/components/season-picker.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Alert } from '$lib/components/ui/alert';
  import LineChart from '$lib/components/ui/line-chart/line-chart.svelte';
  import * as Table from '$lib/components/ui/table';
  import { Handshake, Settings, Swords, X, CheckCircle, AlertCircle } from 'lucide-svelte';
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

  let filteredUsers: number[] = $state([]);
  let matches = $derived(
    (data.matches ?? []).filter((match) => {
      // If filteredUsers is empty, show all matches
      if (filteredUsers.length === 0) {
        return true;
      }

      // If filteredUsers is not empty, show only matches that contain all of the filtered users
      return filteredUsers.every(
        (userId) =>
          match.team1.member1 === userId ||
          match.team1.member2 === userId ||
          match.team2.member1 === userId ||
          match.team2.member2 === userId
      );
    })
  );

  const profileSuffix = data.isCurrentUser ? ' - You' : '';
</script>

<div class="flex flex-col gap-6">
  {#if data.user?.displayName}
    <PageTitle
      >{data.user?.displayName} ({data.user?.name}){profileSuffix}</PageTitle
    >
  {:else}
    <PageTitle>{data.user?.name}{profileSuffix}</PageTitle>
  {/if}

  {#if form?.success}
    <Alert variant="success">
      <div class="flex items-center gap-2">
        <CheckCircle class="h-4 w-4" />
        <span class="font-medium">{form.message}</span>
      </div>
    </Alert>
  {:else if form?.success === false}
    <Alert variant="destructive">
      <div class="flex items-center gap-2">
        <AlertCircle class="h-4 w-4" />
        <span class="font-medium">{form.message}</span>
      </div>
    </Alert>
  {/if}

  {#if data.isCurrentUser}
    <div class="flex justify-end gap-2">
      <Button href="/profile/settings" class="gap-2" variant="outline">
        <Settings size={16} />
        Settings
      </Button>
      <SignOutButton>
        <Button variant="secondary">Logout</Button>
      </SignOutButton>
    </div>
  {/if}

  {#if data.seasons != null && data.seasons.length > 1}
    <div class="self-end">
      <SeasonPicker seasons={data.seasons} currentSeason={data.currentSeason} />
    </div>
  {/if}

  <div class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
    <Kpi title="MMR">{data.stats.mmr ?? '🐣'}</Kpi>
    <Kpi title="# Matches">
      {data.stats.totalMatches}
    </Kpi>
    <Kpi title="# Wins">
      {data.stats.wins}
    </Kpi>
    <Kpi title="# Losses">
      {data.stats.lost}
    </Kpi>
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
  </div>

  {#if data.mmrHistory.length > 0}
    <h2 class="-mb-6 mt-6 text-2xl md:text-4xl">Rating over time</h2>

    <LineChart
      data={data.mmrHistory.map((stat) => ({
        date: stat.date,
        player: stat.name,
        rating: stat.mmr,
      }))}
      height={300}
      legend={false}
    />
  {/if}

  {#if data.opponents.length > 0}
    <Card.Root>
      <Card.Content class="flex flex-col p-0 md:p-6">
        <h2
          class="flex items-center space-x-2 px-4 py-3 text-xl md:p-0 md:text-2xl"
        >
          <Swords /><span>Most common opponents</span>
        </h2>
        <Table.Root class="">
          <Table.Header>
            <Table.Row>
              <!-- <Table.Head class="w-[3ch]">#</Table.Head> -->
              <Table.Head class="">Player</Table.Head>
              <Table.Head class="">
                <span class="sm:hidden">W</span>
                <span class="hidden sm:inline">Wins</span>
              </Table.Head>
              <Table.Head class="">
                <span class="sm:hidden">L</span>
                <span class="hidden sm:inline">Losses</span>
              </Table.Head>
              <Table.Head class="text-right">Win %</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.opponents as { playerId, losses, wins, total }}
              {@const playerUser = data.users?.find(
                (user) => user.userId == playerId
              )}
              <Table.Row>
                <!-- <Table.Cell class="max-w-[3ch] font-bold">{rank}</Table.Cell> -->
                <Table.Cell>
                  <div class="flex flex-col items-start">
                    {#if playerUser?.displayName != null}
                      <span class="hidden w-full truncate sm:block">
                        {playerUser?.displayName}
                      </span>
                    {/if}
                    <span class="block">{playerUser?.name}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {wins}
                </Table.Cell>
                <Table.Cell>
                  {losses}
                </Table.Cell>
                <Table.Cell class="text-right">
                  {winRateFormatter.format(wins / total)}
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
        <Table.Root class="p-0">
          <Table.Header>
            <Table.Row>
              <!-- <Table.Head class="w-[3ch]">#</Table.Head> -->
              <Table.Head class="">Player</Table.Head>
              <Table.Head class="">
                <span class="sm:hidden">W</span>
                <span class="hidden sm:inline">Wins</span>
              </Table.Head>
              <Table.Head class="">
                <span class="sm:hidden">L</span>
                <span class="hidden sm:inline">Losses</span>
              </Table.Head>
              <Table.Head class="text-right">Win %</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.teammates as { playerId, losses, wins, total }}
              {@const playerUser = data.users?.find(
                (user) => user.userId == playerId
              )}
              <Table.Row>
                <!-- <Table.Cell class="max-w-[3ch] font-bold">{rank}</Table.Cell> -->
                <Table.Cell>
                  <div class="flex flex-col items-start">
                    {#if playerUser?.displayName != null}
                      <span class="hidden w-full truncate sm:block">
                        {playerUser?.displayName}
                      </span>
                    {/if}
                    <span class="block">{playerUser?.name}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {wins}
                </Table.Cell>
                <Table.Cell>
                  {losses}
                </Table.Cell>
                <Table.Cell class="text-right">
                  {winRateFormatter.format(wins / total)}
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
      <h2 class="text-2xl md:text-4xl">Matches</h2>
      <div class="flex flex-col space-y-2">
        <Filter
          users={data.users ?? []}
          onSelectedUser={(filteredUserId) => {
            filteredUsers = [...filteredUsers, filteredUserId];
          }}
        />
        <div class="flex space-x-1">
          {#each filteredUsers as filteredUser}
            {@const user = data.users?.find((u) => u.userId === filteredUser)}
            {#if user != null}
              <div
                class="bg-secondary text-secondary-foreground flex items-center space-x-2 rounded-md p-3"
              >
                <span>{user.displayName ?? user.name}</span>
                <button
                  onclick={() => {
                    filteredUsers = filteredUsers.filter(
                      (userId) => userId !== filteredUser
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
        {#each matches as match (match.date)}
          <MatchCard users={data.users ?? []} {match} showMmr showFlagButton={data.profile?.userId != null} />
        {/each}
      </div>
    </div>
  {/if}
</div>
