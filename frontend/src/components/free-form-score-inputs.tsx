import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAX_SCORE } from '@/lib/scoring';

interface FreeFormScoreInputsProps {
  team1Label: string;
  team2Label: string;
  team1Score: number;
  team2Score: number;
  onTeam1ScoreChange: (score: number) => void;
  onTeam2ScoreChange: (score: number) => void;
}

// -1 keeps the submit step hidden until both scores are valid.
function parseScore(target: HTMLInputElement): number {
  const n = target.valueAsNumber;
  return Number.isInteger(n) && n >= 0 && n <= MAX_SCORE ? n : -1;
}

export function FreeFormScoreInputs({
  team1Label,
  team2Label,
  team1Score,
  team2Score,
  onTeam1ScoreChange,
  onTeam2ScoreChange,
}: FreeFormScoreInputsProps) {
  const isTie =
    team1Score !== -1 && team2Score !== -1 && team1Score === team2Score;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row items-end gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="team1-score-input">{team1Label}</Label>
          <Input
            id="team1-score-input"
            type="number"
            inputMode="numeric"
            min="0"
            max={MAX_SCORE}
            step="1"
            value={team1Score === -1 ? '' : team1Score}
            onChange={(e) => {
              const next = parseScore(e.currentTarget);
              if (next !== team1Score) onTeam1ScoreChange(next);
            }}
          />
        </div>
        <div className="pb-2 text-2xl">–</div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="team2-score-input">{team2Label}</Label>
          <Input
            id="team2-score-input"
            type="number"
            inputMode="numeric"
            min="0"
            max={MAX_SCORE}
            step="1"
            value={team2Score === -1 ? '' : team2Score}
            onChange={(e) => {
              const next = parseScore(e.currentTarget);
              if (next !== team2Score) onTeam2ScoreChange(next);
            }}
          />
        </div>
      </div>
      {isTie ? (
        <p className="text-center text-sm text-destructive" role="alert">
          Scores can&apos;t be equal — there must be a clear winner.
        </p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Whole numbers from 0 to {MAX_SCORE}. The higher score wins.
        </p>
      )}
    </div>
  );
}
