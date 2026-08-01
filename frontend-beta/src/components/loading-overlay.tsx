import { LoaderCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  /**
   * Optional — the Svelte version bound `isLoading` two-way, but the dialog is
   * non-dismissible, so nothing ever closes it from the inside. Provided only
   * so Radix's controlled `open` contract is complete.
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Non-dismissible "work in progress" modal.
 *
 * Two behaviours carried over verbatim from the Svelte original:
 *  - The built-in close button is hidden. Svelte did it with a scoped global
 *    rule `.loading-dialog > button[data-dialog-close] { display: none }`;
 *    here the same selector is expressed as a Tailwind arbitrary variant so no
 *    global stylesheet is needed. `data-dialog-close` is emitted by our Dialog
 *    for exactly this reason (Radix does not add it).
 *  - Escape and outside clicks are ignored, matching bits-ui's
 *    `escapeKeydownBehavior`/`interactOutsideBehavior="defer-otherwise-ignore"`.
 */
export function LoadingOverlay({
  isLoading,
  message,
  onOpenChange,
}: LoadingOverlayProps) {
  return (
    <Dialog open={isLoading} onOpenChange={onOpenChange}>
      <DialogContent
        className="loading-dialog flex flex-col items-center justify-center [&>button[data-dialog-close]]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Radix requires a title for the dialog's accessible name; the Svelte
            version had none and logged a warning. Hidden, so nothing changes
            visually. */}
        <DialogTitle className="sr-only">{message ?? 'Loading'}</DialogTitle>
        {message ? message : null}
        <LoaderCircle className="animate-spin" />
      </DialogContent>
    </Dialog>
  );
}
