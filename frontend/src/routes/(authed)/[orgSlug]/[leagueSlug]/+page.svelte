<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import * as Table from '$lib/components/ui/table';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const playerName = (leaguePlayerId: string) => {
    const player = data.players?.find(
      (p: { id: string }) => p.id === leaguePlayerId
    );
    return player?.displayName ?? player?.username ?? 'Unknown';
  };
</script>

<div class="flex flex-col gap-4">
  <PageTitle>Leaderboard</PageTitle>

  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head class="w-[3ch]">#</Table.Head>
        <Table.Head>Player</Table.Head>
        <Table.Head class="text-right">MMR</Table.Head>
        <Table.Head class="text-right">W</Table.Head>
        <Table.Head class="text-right">L</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each data.leaderboard?.entries ?? [] as entry}
        <Table.Row>
          <Table.Cell class="font-bold">{entry.rank}</Table.Cell>
          <Table.Cell>
            <a
              href="/{data.orgSlug}/{data.leagueSlug}/player/{entry.leaguePlayerId}"
              class="hover:underline"
            >
              {entry.displayName ?? entry.username ?? 'Unknown'}
            </a>
          </Table.Cell>
          <Table.Cell class="text-right">{entry.mmr ?? 'N/A'}</Table.Cell>
          <Table.Cell class="text-right">{entry.wins ?? 0}</Table.Cell>
          <Table.Cell class="text-right">{entry.losses ?? 0}</Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>

  {#if data.recentMatches?.length > 0}
    <h2 class="text-2xl md:text-4xl">Recent Matches</h2>
    <div class="flex flex-1 flex-col items-stretch gap-2">
      {#each data.recentMatches as match}
        <div class="bg-card rounded-lg border p-3">
          <div class="flex items-center justify-between text-sm">
            {#each match.teams ?? [] as team}
              <div class="flex flex-col items-center gap-1">
                <span class="text-lg font-bold">{team.score}</span>
                {#each team.players ?? [] as player}
                  <a
                    href="/{data.orgSlug}/{data.leagueSlug}/player/{player.leaguePlayerId}"
                    class="hover:underline"
                  >
                    {player.displayName ?? player.username ?? 'Unknown'}
                  </a>
                {/each}
                {#if team.isWinner}
                  <span class="text-xs font-semibold text-green-600">Winner</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
