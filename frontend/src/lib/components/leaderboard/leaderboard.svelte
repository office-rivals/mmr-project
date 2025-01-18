<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import * as Table from '$lib/components/ui/table';
  import { SHOW_STREAK_THRESHOLD } from '$lib/constants';
  import type { PlayerHistoryDetails, UserDetails } from '../../../api';
  import Sparkline from '../ui/sparkline/sparkline.svelte';
  import type { RankedLeaderboardEntry } from './leader-board-entry';

  export let data: RankedLeaderboardEntry[];
  export let users: UserDetails[] | null | undefined;
  export let onSelectedUser: (user: UserDetails) => void;
  export let statisticsPromise: Promise<PlayerHistoryDetails[]> | undefined;
</script>

<Card.Root>
  <Card.Content class="p-0 md:p-6">
    <Table.Root class="">
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-[3ch]">#</Table.Head>
          <Table.Head class="w-[230px]">Player</Table.Head>
          <Table.Head class="">
            <span class="sm:hidden">W</span>
            <span class="hidden sm:inline">Wins</span>
          </Table.Head>
          <Table.Head class="">
            <span class="sm:hidden">L</span>
            <span class="hidden sm:inline">Losses</span>
          </Table.Head>
          <Table.Head class="text-right">Score</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each data as { userId, loses, name, wins, mmr, winningStreak, losingStreak, rank }}
          {@const userDisplayName = users?.find(
            (user) => user.userId == userId
          )?.displayName}
          <Table.Row
            class="cursor-pointer"
            tabindex={0}
            on:click={() => {
              const user = users?.find((user) => user.userId == userId);
              if (user) {
                onSelectedUser(user);
              }
            }}
          >
            <Table.Cell class="max-w-[3ch] font-bold">{rank}</Table.Cell>
            <Table.Cell class="max-w-[230px]">
              <div class="flex flex-col items-start">
                {#if userDisplayName != null}
                  <span class="hidden w-full truncate sm:block">
                    {userDisplayName}
                  </span>
                {/if}
                <span class="block">{name}</span>
              </div>
            </Table.Cell>
            <Table.Cell>
              <div class="flex flex-row items-center gap-2">
                {wins}
                {#if winningStreak && winningStreak >= SHOW_STREAK_THRESHOLD}
                  <span class="text-nowrap text-xs" title="Winning streak">
                    🔥 <span class="hidden sm:inline">{winningStreak}</span>
                  </span>
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell>
              <div class="flex flex-row items-center gap-2">
                {loses}
                {#if losingStreak && losingStreak >= SHOW_STREAK_THRESHOLD}
                  <span class="text-nowrap text-xs" title="Losing streak">
                    🌧️ <span class="hidden sm:inline">{losingStreak}</span>
                  </span>
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell>
              <div class="flex justify-end gap-2">
                {#if mmr != null}
                  <div class="pointer-events-none hidden w-14 md:block">
                    {#await statisticsPromise}
                      <Sparkline
                        data={[]}
                        options={{ data: { loading: true } }}
                      />
                    {:then stats}
                      {#if stats != null}
                        <Sparkline
                          data={(stats ?? [])
                            .filter((stat) => stat.userId === userId)
                            .map((stat) => ({
                              date: stat.date,
                              rating: stat.mmr,
                            }))}
                        />
                      {/if}
                    {/await}
                  </div>
                {/if}
                <span>
                  {mmr ?? '🐣'}
                </span>
              </div>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </Card.Content>
</Card.Root>
