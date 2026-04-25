<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import type { MatchResponse } from '../../../api-v3/models';
  import MmrDelta from './mmr-delta.svelte';

  interface Props {
    match: MatchResponse;
    showMmr?: boolean;
    playerHref?: (leaguePlayerId: string) => string;
  }

  let { match, showMmr = false, playerHref }: Props = $props();

  const team1 = $derived(
    match.teams.find((t) => t.index === 0) ?? match.teams[0]
  );
  const team2 = $derived(
    match.teams.find((t) => t.index === 1) ?? match.teams[1]
  );

  const playerName = (p: { displayName?: string; username?: string }) =>
    p.username ?? p.displayName ?? 'Unknown';
</script>

<Card.Root>
  <div class="flex flex-row items-center gap-1 px-2 py-1 md:px-4 md:py-2">
    <div
      class="flex flex-1 flex-row items-center gap-4"
      class:text-primary={team1?.isWinner}
    >
      <p class="min-w-[1.5ch] text-4xl font-extrabold">
        {team1?.score === 0 ? '🥚' : team1?.score}
      </p>
      <div class="flex flex-1 flex-col items-start">
        {#each team1?.players ?? [] as player}<p class="space-x-1">
            {#if playerHref}<a
                class="hover:underline"
                href={playerHref(player.leaguePlayerId)}>{playerName(player)}</a
              >{:else}<span>{playerName(player)}</span
              >{/if}{#if showMmr}<MmrDelta delta={player.ratingDelta} />{/if}
          </p>{/each}
      </div>
    </div>
    <div class="flex flex-col items-center">
      vs.
      {#if match.playedAt}
        <p
          class="text-muted-foreground"
          title={new Date(match.playedAt).toDateString()}
        >
          {new Date(match.playedAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      {/if}
    </div>
    <div
      class="flex flex-1 flex-row items-center gap-4"
      class:text-primary={team2?.isWinner}
    >
      <div class="flex flex-1 flex-col items-end">
        {#each team2?.players ?? [] as player}<p class="space-x-1">
            {#if showMmr}<MmrDelta
                delta={player.ratingDelta}
              />{/if}{#if playerHref}<a
                class="hover:underline"
                href={playerHref(player.leaguePlayerId)}>{playerName(player)}</a
              >{:else}<span>{playerName(player)}</span>{/if}
          </p>{/each}
      </div>
      <p class="min-w-[1.5ch] text-right text-4xl font-extrabold">
        {team2?.score === 0 ? '🥚' : team2?.score}
      </p>
    </div>
  </div>
</Card.Root>
