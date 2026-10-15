import { StepHeading } from './step-heading';
import { cn } from '@/lib/utils';

interface WinnerStepProps {
  /** True once "we" already hold `winningScore`; that side is the pick. */
  weDisabled: boolean;
  theyDisabled: boolean;
  onWeWon: () => void;
  onTheyWon: () => void;
  step?: number;
}

const choice =
  'flex h-14 flex-1 items-center justify-center rounded-md border text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * `#winner-step`, shared by the submit page and the active-match page.
 *
 * The picked side stays enabled, so focus does not drop to the page when it is
 * chosen; picking it again does nothing. The labels keep a non-breaking space
 * before the emoji; e2e matches `/We won/` and `/They won/`.
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
          onClick={weDisabled ? undefined : onWeWon}
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
          onClick={theyDisabled ? undefined : onTheyWon}
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
