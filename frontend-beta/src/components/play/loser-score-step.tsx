import { Button } from '@/components/ui/button';

interface LoserScoreStepProps {
  /** `your` when the current user's side lost, `their` otherwise. */
  possessive: 'your' | 'their';
  /** `loserScoreOptions(winningScore)` — 0 … winningScore - 1. */
  options: number[];
  /** The losing side's currently picked score, or -1. */
  selected: number;
  onPick: (score: number) => void;
}

/**
 * `#score-step`: the loser's 0..(winningScore - 1) picker for fixed-target
 * leagues. Score 0 renders as 🥚 — a zero score is legitimate, so nothing here
 * may treat it as falsy.
 */
export function LoserScoreStep({
  possessive,
  options,
  selected,
  onPick,
}: LoserScoreStepProps) {
  return (
    <div id="score-step" className="mt-6 flex flex-col gap-4">
      <h2 className="text-center text-4xl">What was {possessive} score?</h2>
      <div className="grid grid-cols-5 gap-2">
        {options.map((score) => (
          <Button
            key={score}
            type="button"
            variant={selected === score ? 'default' : 'outline'}
            onClick={() => onPick(score)}
          >
            {score === 0 ? '🥚' : score}
          </Button>
        ))}
      </div>
    </div>
  );
}
