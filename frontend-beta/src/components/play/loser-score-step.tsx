import { StepHeading } from './step-heading';
import { cn } from '@/lib/utils';

interface LoserScoreStepProps {
  /** `your` when the current user's side lost, `their` otherwise. */
  possessive: 'your' | 'their';
  /** `loserScoreOptions(winningScore)` — 0 … winningScore - 1. */
  options: number[];
  /** The losing side's currently picked score, or -1. */
  selected: number;
  onPick: (score: number) => void;
  step?: number;
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
  step,
}: LoserScoreStepProps) {
  return (
    <div id="score-step" className="flex flex-col gap-4">
      <StepHeading step={step}>What was {possessive} score?</StepHeading>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))]">
        {options.map((score) => (
          <button
            key={score}
            type="button"
            aria-pressed={selected === score}
            onClick={() => onPick(score)}
            className={cn(
              'flex h-14 items-center justify-center rounded-md border text-xl font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
              selected === score
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:border-primary/60'
            )}
          >
            {score === 0 ? '🥚' : score}
          </button>
        ))}
      </div>
    </div>
  );
}
