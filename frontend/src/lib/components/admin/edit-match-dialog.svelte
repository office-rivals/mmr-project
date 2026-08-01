<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
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
  let submitting = $state(false);
  // Bumped on every (re)open, so a response can tell whether the dialog it was
  // submitted from is still the one on screen. Not $state — it is only ever
  // compared, and reactivity would re-trigger the effect that bumps it.
  let generation = 0;

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
      generation += 1;
      // `submitting` is deliberately not cleared here: it tracks a request, not
      // a dialog. Clearing it on reopen would let a cancel-then-reopen fire a
      // second PATCH alongside the first, and whichever commits last wins —
      // which can be the edit the admin already abandoned.
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
        use:enhance={({ cancel }) => {
          // Two responses would race to decide whether the dialog closes or
          // shows an error.
          if (submitting) {
            cancel();
            return;
          }
          submitting = true;
          const submittedGeneration = generation;

          // reset:false — the visible controls are unnamed, so the payload is
          // entirely the hidden `teams` field and there is nothing to reset.
          // Resetting anyway drops every <select> to its first option, and
          // Svelte syncs that back through bind:value, leaving `teams` holding
          // one player four times under a duplicate-player error.
          return async ({ update, result }) => {
            try {
              // Superseded: still refresh the list this save changed, but do
              // not let applyAction paint a dead save's error over the dialog
              // the admin has since reopened.
              if (submittedGeneration !== generation) {
                if (result.type === 'success') await invalidateAll();
                return;
              }

              await update({ reset: false });

              // Re-checked: update() awaits a full reload, and the admin can
              // cancel and reopen during it.
              if (submittedGeneration !== generation) return;

              if (result.type === 'failure') {
                const failData = result.data as
                  | { message?: string }
                  | undefined;
                formError = failData?.message ?? 'Failed to update match';
              } else if (result.type === 'success') {
                onOpenChange(false);
              }
            } finally {
              // Unconditional: `submitting` tracks this request, so leaving it
              // set after a superseded response would disable Save for good.
              submitting = false;
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
          <Button type="submit" disabled={duplicate || submitting}>
            {submitting ? 'Saving…' : 'Save match'}
          </Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>
