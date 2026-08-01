import { useState } from 'react';
import { Flag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FlagDialogsProps {
  open: boolean;
  /** Non-null when an existing flag of the viewer's is being edited. */
  editingFlagId: string | null;
  /**
   * The reason the textarea starts with each time the dialog opens — the
   * existing flag's text when editing, `''` when creating.
   */
  initialReason: string;
  onClose: () => void;
  /** Create (no `editingFlagId`) or update (with one). */
  onSubmit: (reason: string) => void;
  deleteConfirmOpen: boolean;
  onDeleteConfirmChange: (open: boolean) => void;
  onDelete: () => void;
}

/**
 * The two match-flag dialogs from the profile page.
 *
 * Dialog B (delete confirmation) opens **on top of** dialog A and does not
 * close it — cancelling returns to the edit form with the reason still typed.
 * Both submit handlers are wired so a server-side failure keeps the dialog
 * open with the text intact and surfaces the message in the page-level alert.
 *
 * The textarea value is owned **here**, not by the page. In Svelte the profile's
 * `matches` / `matchGroups` / `chartData` were `$derived` and untouched by
 * `flagReason`; in React a page-level value would re-render the whole profile —
 * up to 1000 match cards and a Carbon chart data-swap — on every keystroke.
 */
export function FlagDialogs({
  open,
  editingFlagId,
  initialReason,
  onClose,
  onSubmit,
  deleteConfirmOpen,
  onDeleteConfirmChange,
  onDelete,
}: FlagDialogsProps) {
  const [reason, setReason] = useState(initialReason);
  // Re-seed on the closed→open transition, which is where Svelte's
  // `openFlagDialog` assigned `flagReason`. Adjusting state during render (no
  // effect) so the first painted frame already shows the right text.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReason(initialReason);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFlagId ? 'Edit Flag' : 'Flag Match'}
            </DialogTitle>
            <DialogDescription>
              {editingFlagId
                ? 'Update or delete your flag for this match.'
                : 'Report an issue with this match.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit(reason);
              }}
            >
              <div className="space-y-2">
                <label htmlFor="reason" className="text-sm font-medium">
                  Reason
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Describe the issue..."
                />
                <p className="text-xs text-muted-foreground">
                  {reason.length}/500
                </p>
              </div>
              <DialogFooter className="mt-4 gap-2">
                {editingFlagId ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteConfirmChange(true)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!reason.trim()}>
                  {editingFlagId ? null : <Flag className="mr-1 h-3.5 w-3.5" />}
                  {editingFlagId ? 'Update Flag' : 'Flag Match'}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={onDeleteConfirmChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Flag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this flag? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onDelete();
            }}
          >
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onDeleteConfirmChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive">
                Delete Flag
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
