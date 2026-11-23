import { useState } from 'react';
import { Flag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  editingFlagId: string | null;
  initialReason: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  deleteConfirmOpen: boolean;
  onDeleteConfirmChange: (open: boolean) => void;
  onDelete: () => void;
}

// Local textarea state avoids rebuilding the match list and chart while typing.
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
  // Re-seed before the first reopened frame without an effect delay.
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
                <Textarea
                  id="reason"
                  name="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Describe the issue..."
                />
                <p className="text-xs text-muted-foreground">
                  {`${reason.length}/500`}
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
