import { StepHeading } from './step-heading';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface WinnerStepProps {
  /** True once "we" already hold `winningScore`; that side is the pick. */
  weDisabled: boolean;
  theyDisabled: boolean;
  onWeWon: () => void;
  onTheyWon: () => void;
  step?: number;
}

/**
 * `#winner-step`, shared by the submit page and the active-match page.
 *
 * Pressing the picked side again would un-press it; that change is ignored, so
 * a winner, once picked, can only be swapped. The labels keep a non-breaking
 * space before the emoji; e2e matches `/We won/` and `/They won/`.
 */
export function WinnerStep({
  weDisabled,
  theyDisabled,
  onWeWon,
  onTheyWon,
  step,
}: WinnerStepProps) {
  const value = weDisabled ? ['we'] : theyDisabled ? ['they'] : [];
  return (
    <div id="winner-step" className="flex flex-col gap-4">
      <StepHeading step={step}>Who won?</StepHeading>
      <ToggleGroup
        aria-label="Who won?"
        value={value}
        onValueChange={([next]) => {
          if (next === 'we') onWeWon();
          else if (next === 'they') onTheyWon();
        }}
      >
        <ToggleGroupItem value="we" className="flex-1 text-lg">
          {'We won   🎉'}
        </ToggleGroupItem>
        <ToggleGroupItem value="they" className="flex-1 text-lg">
          {'They won   😓'}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
