import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getPlayerDisplayName } from '@/lib/utils';
import type { LeaguePlayerResponse, MatchResponse } from '@/api-v3';

export interface EditMatchTeamPayload {
  score: number;
  players: { leaguePlayerId: string }[];
}

export interface EditMatchResult {
  success: boolean;
  message: string;
}

export interface EditMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: MatchResponse | null;
  leaguePlayers: LeaguePlayerResponse[];
  /**
   * Replaces the Svelte `formAction` prop. The host must not resolve until the
   * data reload it triggers has finished — the dialog closes on the resolved
   * value, and the e2e reads "dialog gone" as "saved and list refreshed".
   *
   * The host is also responsible for the page-level outcome (success/error
   * banner + refetch): this dialog drops a superseded response's effect on
   * *itself*, never the outcome the admin is owed.
   */
  onSave: (input: {
    matchId: string;
    teams: EditMatchTeamPayload[];
  }) => Promise<EditMatchResult>;
}

type SlotState = { leaguePlayerId: string };
// `score` widens to string because a number input hands back strings; the
// payload coerces with `Number(...)`, exactly like the Svelte version.
type TeamState = { players: SlotState[]; score: number | string };

const seedTeams = (match: MatchResponse): TeamState[] =>
  match.teams
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((team) => ({
      players: team.players
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((p) => ({ leaguePlayerId: p.leaguePlayerId })),
      score: team.score,
    }));

/**
 * Shared by the admin matches page and the match-flags page.
 */
export function EditMatchDialog({
  open,
  onOpenChange,
  match,
  leaguePlayers,
  onSave,
}: EditMatchDialogProps) {
  const [teams, setTeams] = useState<TeamState[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Match ids with a save in flight. Keyed by match, because a request
  // outstanding for one match says nothing about another — and tracked past the
  // dialog that started it, since clearing on reopen would let a
  // cancel-then-reopen fire a second PATCH alongside the first, and whichever
  // commits last wins.
  //
  // The ref is the guard (two submits in one tick both read it, which stale
  // state would not give us); the state exists only so the button re-renders.
  const inFlightRef = useRef<Set<string>>(new Set());
  const [inFlightIds, setInFlightIds] = useState<string[]>([]);
  const submitting = !!match && inFlightIds.includes(match.id);

  // Bumped on every (re)open, so a response can tell whether the dialog it was
  // submitted from is still the one on screen. A ref, not state: it is only
  // ever compared, and re-rendering on it would re-trigger the effect that
  // bumps it.
  const generationRef = useRef(0);
  const wasOpenRef = useRef(false);
  // Whether the admin has touched this dialog since it opened. A ref for the
  // same reason as `generationRef`.
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!open || !match) {
      wasOpenRef.current = open;
      return;
    }
    const reopened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (reopened) {
      generationRef.current += 1;
      dirtyRef.current = false;
      setFormError(null);
    }
    // Seeded on open, and re-seeded when a data reload delivers a fresher copy
    // of a match the admin has not started editing. Without the latter, a
    // reopen that races the previous save's reload keeps rendering the scores
    // from before that save — and writes them back over it on the next Save.
    // The `dirty` guard is what stops a refetch stomping edits in progress.
    if (reopened || !dirtyRef.current) {
      setTeams(seedTeams(match));
    }
    // No `else`: closing leaves `teams` populated, same as the Svelte $effect.
  }, [open, match]);

  const playerName = (id: string) =>
    getPlayerDisplayName(leaguePlayers.find((lp) => lp.id === id));

  const duplicate = useMemo(() => {
    const seen = new Set<string>();
    for (const team of teams) {
      for (const slot of team.players) {
        if (!slot.leaguePlayerId) return true;
        if (seen.has(slot.leaguePlayerId)) return true;
        seen.add(slot.leaguePlayerId);
      }
    }
    return false;
  }, [teams]);

  const payload = useMemo<EditMatchTeamPayload[]>(
    () =>
      teams.map((team) => ({
        score: Number(team.score),
        players: team.players.map((p) => ({
          leaguePlayerId: p.leaguePlayerId,
        })),
      })),
    [teams]
  );

  const setScore = (teamIndex: number, value: string) =>
    setTeams((prev) =>
      prev.map((team, i) => (i === teamIndex ? { ...team, score: value } : team))
    );

  const setSlot = (teamIndex: number, playerIndex: number, value: string) =>
    setTeams((prev) =>
      prev.map((team, i) =>
        i === teamIndex
          ? {
              ...team,
              players: team.players.map((slot, j) =>
                j === playerIndex ? { leaguePlayerId: value } : slot
              ),
            }
          : team
      )
    );

  const syncInFlight = () => setInFlightIds([...inFlightRef.current]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const matchId = match?.id;
    // Two responses would race to decide whether the dialog closes or shows an
    // error.
    if (!matchId || inFlightRef.current.has(matchId)) return;
    inFlightRef.current.add(matchId);
    syncInFlight();
    // The previous attempt's message is about the payload being replaced right
    // now; leaving it up outlives what it describes.
    setFormError(null);
    const submittedGeneration = generationRef.current;
    const teamsPayload = payload;

    try {
      // Resolves only once the host has applied the outcome and reloaded, so
      // the admin can cancel and reopen while this is pending. That outcome is
      // page-level and still theirs to see; what a dead save must not do is
      // close the dialog they have since reopened, or paint its error inside it.
      const result = await onSave({ matchId, teams: teamsPayload });
      if (submittedGeneration !== generationRef.current) return;

      if (!result.success) {
        setFormError(result.message || 'Failed to update match');
      } else {
        onOpenChange(false);
      }
    } finally {
      // Unconditional: leaving the id in place after a superseded response
      // would disable Save for that match forever.
      inFlightRef.current.delete(matchId);
      syncInFlight();
    }
  };

  const markDirty = () => {
    dirtyRef.current = true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit match</DialogTitle>
          <DialogDescription>
            Replace players or correct scores. Existing rating history is left
            intact — recalculate MMR from this match afterwards if you want the
            edit to flow through to the leaderboard.
          </DialogDescription>
        </DialogHeader>

        {!match ? (
          /* Only reachable once the dialog has been opened on a match that has
             since left the page of results — deleted, or shifted out of the
             window by a reload. Saying "no match selected" would describe a
             state the admin was never in. */
          <p className="py-4 text-center text-sm text-muted-foreground">
            This match is no longer in the list — it may have been deleted, or
            moved to another page.
          </p>
        ) : (
          <form
            className="space-y-5"
            onSubmit={handleSubmit}
            onInput={markDirty}
            onChange={markDirty}
          >
            <input type="hidden" name="matchId" value={match.id} />
            <input
              type="hidden"
              name="teams"
              value={JSON.stringify(payload)}
            />

            {formError && <Alert variant="destructive">{formError}</Alert>}

            {teams.map((team, teamIndex) => (
              <div key={teamIndex} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    Team {teamIndex + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`team-${teamIndex}-score`}
                      className="text-xs text-muted-foreground"
                    >
                      Score
                    </Label>
                    <Input
                      id={`team-${teamIndex}-score`}
                      type="number"
                      min="0"
                      className="w-20"
                      required
                      value={team.score}
                      onChange={(event) =>
                        setScore(teamIndex, event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {team.players.map((slot, playerIndex) => (
                    <div key={playerIndex} className="flex items-center gap-2">
                      <Label className="w-16 text-xs text-muted-foreground">
                        Player {playerIndex + 1}
                      </Label>
                      <select
                        className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                        required
                        value={slot.leaguePlayerId}
                        onChange={(event) =>
                          setSlot(teamIndex, playerIndex, event.target.value)
                        }
                      >
                        <option value="" disabled>
                          Select a player…
                        </option>
                        {leaguePlayers.map((player) => (
                          <option key={player.id} value={player.id}>
                            {playerName(player.id)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {duplicate && (
              <Alert variant="destructive">
                Each player can only appear once across both teams.
              </Alert>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={duplicate || submitting}>
                {submitting ? 'Saving…' : 'Save match'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
