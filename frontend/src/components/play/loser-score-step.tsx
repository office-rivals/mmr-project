import { StepHeading } from './step-heading';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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
      <ToggleGroup
        aria-label={`What was ${possessive} score?`}
        value={selected === -1 ? [] : [String(selected)]}
        // Pressing the picked score again un-presses it; treat that as picking
        // it again so it still moves the user on to submit.
        onValueChange={([next]) =>
          onPick(next === undefined ? selected : Number(next))
        }
        className="grid grid-cols-5 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))]"
      >
        {options.map((score) => (
          <ToggleGroupItem
            key={score}
            value={String(score)}
            className="text-xl tabular-nums"
          >
            {score === 0 ? '🥚' : score}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
