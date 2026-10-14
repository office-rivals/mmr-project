import { Button } from '@/components/ui/button';

interface WinnerStepProps {
  /** True once "we" already hold `winningScore` — the Svelte `disabled` rule. */
  weDisabled: boolean;
  theyDisabled: boolean;
  onWeWon: () => void;
  onTheyWon: () => void;
}

/**
 * `#winner-step`, shared verbatim by the submit page and the active-match page.
 *
 * The button labels contain a non-breaking space before the emoji
 * (`We won &nbsp; 🎉`); e2e matches them with `/We won/` and `/They won/`, but
 * the exact text is part of the parity contract.
 */
export function WinnerStep({
  weDisabled,
  theyDisabled,
  onWeWon,
  onTheyWon,
}: WinnerStepProps) {
  return (
    <div id="winner-step" className="mt-6 flex flex-col gap-4">
      <h2 className="text-center text-4xl">Who won?</h2>
      <div className="flex flex-row gap-4">
        <Button
          type="button"
          onClick={onWeWon}
          className="flex-1"
          variant="default"
          disabled={weDisabled}
        >
          {'We won   🎉'}
        </Button>
        <div className="min-h-full w-px bg-border" />
        <Button
          type="button"
          onClick={onTheyWon}
          className="flex-1"
          variant="destructive"
          disabled={theyDisabled}
        >
          {'They won   😓'}
        </Button>
      </div>
    </div>
  );
}
