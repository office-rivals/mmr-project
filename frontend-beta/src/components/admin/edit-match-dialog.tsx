import { useEffect, useMemo, useState } from 'react';
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

/**
 * Shared by the admin matches page and the match-flags page.
 *
 * This is the parity-target version: `teams` + `formError` and nothing else —
 * no submit guard, no generation counter, no `Saving…` label. The concurrency
 * hardening on `fix/concurrent-match-edit` (spec 06 §8.5) is deliberately NOT
 * implemented here.
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

  // Seeds from the `match` prop, which the hosts capture as a snapshot at click
  // time. Never re-seed from live list data: a refetch during an open dialog
  // would stomp the admin's edits.
  useEffect(() => {
    if (open && match) {
      setTeams(
        match.teams
          .slice()
          .sort((a, b) => a.index - b.index)
          .map((team) => ({
            players: team.players
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((p) => ({ leaguePlayerId: p.leaguePlayerId })),
            score: team.score,
          }))
      );
      setFormError(null);
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
          <p className="py-4 text-center text-sm text-muted-foreground">
            No match selected.
          </p>
        ) : (
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const result = await onSave({
                matchId: match.id,
                teams: payload,
              });
              if (!result.success) {
                setFormError(result.message || 'Failed to update match');
              } else {
                onOpenChange(false);
              }
            }}
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
              {/* Disabled only by `duplicate`: nothing guards double submission
                  on the parity target. */}
              <Button type="submit" disabled={duplicate}>
                Save match
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
