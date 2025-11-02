<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import * as Table from '$lib/components/ui/table';
  import { SHOW_STREAK_THRESHOLD } from '$lib/constants';
  import { cn } from '$lib/utils';
  import type { PlayerHistoryDetails, UserDetails } from '../../../api';
  import Sparkline from '../ui/sparkline/sparkline.svelte';
  import type { RankedLeaderboardEntry } from './leader-board-entry';

  interface Props {
    data: RankedLeaderboardEntry[];
    users: UserDetails[] | null | undefined;
    onSelectedUser: (user: UserDetails) => void;
    statisticsPromise: Promise<PlayerHistoryDetails[]> | undefined;
    currentUserId: number | undefined;
  }

  let { data, users, onSelectedUser, statisticsPromise, currentUserId }: Props =
    $props();
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
        {#each data as { userId, loses, name, wins, mmr, winningStreak, losingStreak, rank }, index}
          {#if mmr == null && (index === 0 || data[index - 1]?.mmr != null)}
            <Table.Row class="">
              <Table.Cell colspan={5} class="text-center">Unranked</Table.Cell>
            </Table.Row>
          {/if}

          {@const userDisplayName = users?.find(
            (user) => user.userId == userId
          )?.displayName}
          <Table.Row
            class={cn('cursor-pointer', {
              'text-primary': currentUserId === userId,
            })}
            tabindex={0}
            onclick={() => {
              const user = users?.find((user) => user.userId == userId);
              if (user) {
                onSelectedUser(user);
              }
            }}
          >
            <Table.Cell class="max-w-[3ch] font-bold"
              >{mmr != null ? rank : '•'}</Table.Cell
            >
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
                    {losingStreak >= 7 ? '⛈️' : '🌧️'}
                    <span class="hidden sm:inline">{losingStreak}</span>
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
