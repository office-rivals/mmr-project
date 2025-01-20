<script lang="ts">
  import Leaderboard from '$lib/components/leaderboard';
  import { MatchCard } from '$lib/components/match-card';
  import PageTitle from '$lib/components/page-title.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import UserStatsModal from '$lib/components/user-stats-modal.svelte';
  import { Checkbox } from 'bits-ui';
  import { Check, Minus } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import type { ActiveMatchDto, UserDetails } from '../../api';
  import { showMmr } from '../../stores/show-mmr';
  import type { PageData } from './$types';
  import ActiveMatches from './components/active-matches.svelte';
  import CurrentActiveMatch from './components/current-active-match.svelte';

  export let data: PageData;
  const {
    leaderboardEntries,
    recentMatches,
    users,
    statisticsPromise,
    activeMatches: initialActiveMatches,
    profile,
  } = data;
  let selectedUser: UserDetails | null | undefined;
  $: leaderboardEntry =
    selectedUser != null
      ? leaderboardEntries?.find(
          (entry) => entry.userId === selectedUser!.userId
        )
      : null;

  const fetchActiveMatches = async () => {
    const response = await fetch(`/api/active-matches`);

    if (response.ok) {
      const data = await response.json();
      return data.activeMatches as ActiveMatchDto[];
    } else {
      throw new Error('Failed to active matches');
    }
  };

  let activeMatches = initialActiveMatches;

  onMount(async () => {
    setInterval(async () => {
      activeMatches = await fetchActiveMatches();
    }, 30000);
  });
</script>

<div class="flex flex-col gap-4">
  <PageTitle>Trifork Foosball</PageTitle>

  <CurrentActiveMatch
    activeMatches={activeMatches ?? []}
    users={users ?? []}
    currentPlayerId={profile?.userId}
  />
  <div class="flex">
    <h2 class="flex-1 text-2xl md:text-4xl">Recent Matches</h2>
    <div class="flex items-center space-x-3 self-center">
      <Label id="show-mmr-label" for="show-mmr">MMR:</Label>
      <Checkbox.Root
        bind:checked={$showMmr}
        id="show-mmr"
        class="border-muted bg-primary active:scale-98 data-[state=unchecked]:border-border-input data-[state=unchecked]:hover:border-dark-40 peer inline-flex size-[25px] items-center justify-center rounded-md border transition-all duration-150 ease-in-out data-[state=unchecked]:bg-white"
      >
        <Checkbox.Indicator let:isChecked let:isIndeterminate>
          {#if isChecked}
            <Check class="text-primary-foreground size-[15px] font-bold" />
          {:else if isIndeterminate}
            <Minus class="size-[15px] font-bold" />
          {/if}
        </Checkbox.Indicator>
      </Checkbox.Root>
    </div>
  </div>
  <div class="flex flex-1 flex-col items-stretch gap-2">
    {#each recentMatches ?? [] as match}
      <MatchCard users={users ?? []} {match} showMmr={$showMmr} />
    {/each}
  </div>
  <h2 class="text-2xl md:text-4xl">Leaderboard</h2>
  <Leaderboard
    data={leaderboardEntries ?? []}
    {users}
    onSelectedUser={(user) => {
      selectedUser = user;
    }}
    {statisticsPromise}
  />
</div>
<ActiveMatches activeMatches={activeMatches ?? []} users={users ?? []} />

{#if selectedUser != null}
  <UserStatsModal
    user={selectedUser}
    users={users ?? []}
    {leaderboardEntry}
    open={selectedUser != null}
    onOpenChange={(open) => {
      if (!open) {
        selectedUser = null;
      }
    }}
  />
{/if}
