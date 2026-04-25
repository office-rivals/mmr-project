<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import * as Table from '$lib/components/ui/table';
  import { SHOW_STREAK_THRESHOLD } from '$lib/constants';
  import { cn } from '$lib/utils';
  import type {
    LeaderboardEntryResponse,
    LeagueRatingHistoryEntry,
  } from '../../../api-v3/models';
  import Sparkline from '../ui/sparkline/sparkline.svelte';

  interface Props {
    entries: LeaderboardEntryResponse[];
    ratingHistory?: LeagueRatingHistoryEntry[];
    onSelect?: (entry: LeaderboardEntryResponse) => void;
    currentLeaguePlayerId?: string | null;
  }

  let { entries, ratingHistory, onSelect, currentLeaguePlayerId }: Props =
    $props();
</script>

<Card.Root>
  <Card.Content class="p-0 md:p-6">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-[3ch]">#</Table.Head>
          <Table.Head class="w-[230px]">Player</Table.Head>
          <Table.Head>
            <span class="sm:hidden">W</span>
            <span class="hidden sm:inline">Wins</span>
          </Table.Head>
          <Table.Head>
            <span class="sm:hidden">L</span>
            <span class="hidden sm:inline">Losses</span>
          </Table.Head>
          <Table.Head class="text-right">Score</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each entries as entry, index (entry.leaguePlayerId)}
          {#if entry.mmr == null && (index === 0 || entries[index - 1]?.mmr != null)}
            <Table.Row>
              <Table.Cell colspan={5} class="text-center">Unranked</Table.Cell>
            </Table.Row>
          {/if}
          <Table.Row
            class={cn('cursor-pointer', {
              'text-primary': currentLeaguePlayerId === entry.leaguePlayerId,
            })}
            tabindex={0}
            onclick={() => onSelect?.(entry)}
          >
            <Table.Cell class="max-w-[3ch] font-bold">
              {entry.mmr != null ? entry.rank : '•'}
            </Table.Cell>
            <Table.Cell class="max-w-[230px]">
              <div class="flex flex-col items-start">
                {#if entry.displayName}
                  <span class="hidden w-full truncate sm:block">
                    {entry.displayName}
                  </span>
                {/if}
                <span class="block"
                  >{entry.username ?? entry.displayName ?? 'Unknown'}</span
                >
              </div>
            </Table.Cell>
            <Table.Cell>
              <div class="flex flex-row items-center gap-2">
                {entry.wins}
                {#if entry.winningStreak >= SHOW_STREAK_THRESHOLD}
                  <span class="text-nowrap text-xs" title="Winning streak">
                    🔥 <span class="hidden sm:inline"
                      >{entry.winningStreak}</span
                    >
                  </span>
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell>
              <div class="flex flex-row items-center gap-2">
                {entry.losses}
                {#if entry.losingStreak >= SHOW_STREAK_THRESHOLD}
                  <span class="text-nowrap text-xs" title="Losing streak">
                    {entry.losingStreak >= 7 ? '⛈️' : '🌧️'}
                    <span class="hidden sm:inline">{entry.losingStreak}</span>
                  </span>
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell>
              <div class="flex justify-end gap-2">
                {#if entry.mmr != null}
                  <div class="pointer-events-none hidden w-14 md:block">
                    {#if ratingHistory != null}
                      <Sparkline
                        data={ratingHistory
                          .filter(
                            (h) => h.leaguePlayerId === entry.leaguePlayerId
                          )
                          .map((h) => ({
                            date: h.recordedAt,
                            rating: h.mmr,
                          }))}
                      />
                    {:else}
                      <Sparkline
                        data={[]}
                        options={{ data: { loading: true } }}
                      />
                    {/if}
                  </div>
                {/if}
                <span>
                  {entry.mmr ?? '🐣'}
                </span>
              </div>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </Card.Content>
</Card.Root>
