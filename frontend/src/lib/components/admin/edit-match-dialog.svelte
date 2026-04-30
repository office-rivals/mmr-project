<script lang="ts">
  import { enhance } from '$app/forms';
  import { Alert } from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { getPlayerDisplayName } from '$lib/utils';
  import type { LeaguePlayerResponse, MatchResponse } from '$api3';

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    match: MatchResponse | null;
    leaguePlayers: LeaguePlayerResponse[];
    formAction?: string;
  }

  let {
    open,
    onOpenChange,
    match,
    leaguePlayers,
    formAction = '?/edit',
  }: Props = $props();

  type SlotState = { leaguePlayerId: string };
  type TeamState = { players: SlotState[]; score: number };

  let teams = $state<TeamState[]>([]);
  let formError = $state<string | null>(null);

  $effect(() => {
    if (open && match) {
      teams = match.teams
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((team) => ({
          players: team.players
            .slice()
            .sort((a, b) => a.index - b.index)
            .map((p) => ({ leaguePlayerId: p.leaguePlayerId })),
          score: team.score,
        }));
      formError = null;
    }
  });

  const playerName = (id: string) =>
    getPlayerDisplayName(leaguePlayers.find((lp) => lp.id === id));

  const duplicate = $derived.by(() => {
    const seen = new Set<string>();
    for (const team of teams) {
      for (const slot of team.players) {
        if (!slot.leaguePlayerId) return true;
        if (seen.has(slot.leaguePlayerId)) return true;
        seen.add(slot.leaguePlayerId);
      }
    }
    return false;
  });

  // Number inputs bound via `bind:value` return strings; coerce so the server
  // parser sees a numeric `score`.
  const payload = $derived(
    JSON.stringify(
      teams.map((team) => ({
        score: Number(team.score),
        players: team.players.map((p) => ({
          leaguePlayerId: p.leaguePlayerId,
        })),
      }))
    )
  );
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Content class="max-w-xl">
    <Dialog.Header>
      <Dialog.Title>Edit match</Dialog.Title>
      <Dialog.Description>
        Replace players or correct scores. Existing rating history is left
        intact — recalculate MMR from this match afterwards if you want the edit
        to flow through to the leaderboard.
      </Dialog.Description>
    </Dialog.Header>

    {#if !match}
      <p class="py-4 text-center text-sm text-muted-foreground">
        No match selected.
      </p>
    {:else}
      <form
        method="POST"
        action={formAction}
        use:enhance={() => {
          return async ({ update, result }) => {
            await update();
            if (result.type === 'failure') {
              const failData = result.data as { message?: string } | undefined;
              formError = failData?.message ?? 'Failed to update match';
            } else if (result.type === 'success') {
              onOpenChange(false);
            }
          };
        }}
        class="space-y-5"
      >
        <input type="hidden" name="matchId" value={match.id} />
        <input type="hidden" name="teams" value={payload} />

        {#if formError}
          <Alert variant="destructive">{formError}</Alert>
        {/if}

        {#each teams as team, teamIndex}
          <div class="space-y-3 rounded-md border p-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold">
                Team {teamIndex + 1}
              </span>
              <div class="flex items-center gap-2">
                <Label
                  for={`team-${teamIndex}-score`}
                  class="text-xs text-muted-foreground"
                >
                  Score
                </Label>
                <Input
                  id={`team-${teamIndex}-score`}
                  type="number"
                  min="0"
                  bind:value={team.score}
                  class="w-20"
                  required
                />
              </div>
            </div>

            <div class="space-y-2">
              {#each team.players as slot, playerIndex}
                <div class="flex items-center gap-2">
                  <Label class="w-16 text-xs text-muted-foreground">
                    Player {playerIndex + 1}
                  </Label>
                  <select
                    bind:value={slot.leaguePlayerId}
                    class="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    required
                  >
                    <option value="" disabled>Select a player…</option>
                    {#each leaguePlayers as player}
                      <option value={player.id}>{playerName(player.id)}</option>
                    {/each}
                  </select>
                </div>
              {/each}
            </div>
          </div>
        {/each}

        {#if duplicate}
          <Alert variant="destructive">
            Each player can only appear once across both teams.
          </Alert>
        {/if}

        <Dialog.Footer class="gap-2">
          <Button
            type="button"
            variant="outline"
            onclick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={duplicate}>Save match</Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>
