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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  /** Resolves after the host has applied the result and refreshed its data. */
  onSave: (input: {
    matchId: string;
    teams: EditMatchTeamPayload[];
  }) => Promise<EditMatchResult>;
}

type SlotState = { leaguePlayerId: string };
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

export function EditMatchDialog({
  open,
  onOpenChange,
  match,
  leaguePlayers,
  onSave,
}: EditMatchDialogProps) {
  const [teams, setTeams] = useState<TeamState[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Keep the guard across close/reopen so one match cannot get racing saves.
  const inFlightRef = useRef<Set<string>>(new Set());
  const [inFlightIds, setInFlightIds] = useState<string[]>([]);
  const submitting = !!match && inFlightIds.includes(match.id);

  // Identifies the dialog generation that owns an asynchronous response.
  const generationRef = useRef(0);
  const wasOpenRef = useRef(false);
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
    // Accept refreshed scores until the admin edits this dialog generation.
    if (reopened || !dirtyRef.current) {
      setTeams(seedTeams(match));
    }
  }, [open, match]);

  const playerItems = useMemo(
    () =>
      leaguePlayers.map((player) => ({
        value: player.id,
        label: getPlayerDisplayName(player),
      })),
    [leaguePlayers]
  );

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
      prev.map((team, i) =>
        i === teamIndex ? { ...team, score: value } : team
      )
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
    if (!matchId || inFlightRef.current.has(matchId)) return;
    inFlightRef.current.add(matchId);
    syncInFlight();
    setFormError(null);
    const submittedGeneration = generationRef.current;
    const teamsPayload = payload;

    try {
      const result = await onSave({ matchId, teams: teamsPayload });
      if (submittedGeneration !== generationRef.current) return;

      if (!result.success) {
        setFormError(result.message || 'Failed to update match');
      } else {
        onOpenChange(false);
      }
    } finally {
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
            <input type="hidden" name="teams" value={JSON.stringify(payload)} />

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
                      <Label
                        htmlFor={`team-${teamIndex}-player-${playerIndex}`}
                        className="w-16 text-xs text-muted-foreground"
                      >
                        Player {playerIndex + 1}
                      </Label>
                      <Select
                        items={playerItems}
                        required
                        value={slot.leaguePlayerId || null}
                        onValueChange={(id) =>
                          setSlot(teamIndex, playerIndex, id ?? '')
                        }
                      >
                        <SelectTrigger
                          id={`team-${teamIndex}-player-${playerIndex}`}
                          className="h-9 flex-1 lg:h-9"
                        >
                          <SelectValue placeholder="Select a player…" />
                        </SelectTrigger>
                        <SelectContent align="start" sideOffset={4}>
                          {playerItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
