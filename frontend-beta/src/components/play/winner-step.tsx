import { StepHeading } from './step-heading';
import { cn } from '@/lib/utils';

interface WinnerStepProps {
  /** True once "we" already hold `winningScore` — the Svelte `disabled` rule. */
  weDisabled: boolean;
  theyDisabled: boolean;
  onWeWon: () => void;
  onTheyWon: () => void;
  step?: number;
}

const choice =
  'flex h-14 flex-1 items-center justify-center rounded-md border text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default';

/**
 * `#winner-step`, shared by the submit page and the active-match page.
 *
 * The picked side is disabled (it already holds the winning score), so it is
 * drawn as the selected choice rather than greyed out. The labels keep a
 * non-breaking space before the emoji; e2e matches `/We won/` and `/They won/`.
 */
export function WinnerStep({
  weDisabled,
  theyDisabled,
  onWeWon,
  onTheyWon,
  step,
}: WinnerStepProps) {
  return (
    <div id="winner-step" className="flex flex-col gap-4">
      <StepHeading step={step}>Who won?</StepHeading>
      <div className="flex flex-row gap-3">
        <button
          type="button"
          onClick={onWeWon}
          disabled={weDisabled}
          aria-pressed={weDisabled}
          className={cn(
            choice,
            weDisabled
              ? 'border-primary-fill bg-primary-fill text-primary-foreground'
              : 'bg-card hover:border-primary/60'
          )}
        >
          {'We won   🎉'}
        </button>
        <button
          type="button"
          onClick={onTheyWon}
          disabled={theyDisabled}
          aria-pressed={theyDisabled}
          className={cn(
            choice,
            theyDisabled
              ? 'border-primary-fill bg-primary-fill text-primary-foreground'
              : 'bg-card hover:border-primary/60'
          )}
        >
          {'They won   😓'}
        </button>
      </div>
    </div>
  );
}
