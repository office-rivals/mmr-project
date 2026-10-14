import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface NewPlayerDraft {
  displayName: string;
  username: string;
  email: string;
  error: string;
}

interface NewPlayerDialogProps {
  open: boolean;
  draft: NewPlayerDraft;
  onDraftChange: (patch: Partial<NewPlayerDraft>) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

/**
 * "Add new player" — opened from a slot's `Add new player` button with the
 * current filter text pre-filled as the display name.
 *
 * Fully dismissible (overlay click, Escape, the built-in close `X`), unlike the
 * pending-match dialog on /matchmaking. Cancelling does not clear the slot,
 * because the slot was never set.
 */
export function NewPlayerDialog({
  open,
  draft,
  onDraftChange,
  onOpenChange,
  onSave,
}: NewPlayerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add new player</DialogTitle>
          <DialogDescription>
            Create a player for this match. If you add an email, the address can
            be claimed later.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          {draft.error ? (
            <Alert variant="destructive">{draft.error}</Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="new-player-display-name">Display name</Label>
            <Input
              id="new-player-display-name"
              value={draft.displayName}
              onChange={(e) =>
                onDraftChange({ displayName: e.currentTarget.value })
              }
              placeholder="New teammate"
              spellCheck={false}
              autoCorrect="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-player-username">Username (optional)</Label>
            <Input
              id="new-player-username"
              value={draft.username}
              onChange={(e) =>
                onDraftChange({ username: e.currentTarget.value })
              }
              placeholder="short-handle"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-player-email">Email (optional)</Label>
            <Input
              id="new-player-email"
              value={draft.email}
              onChange={(e) => onDraftChange({ email: e.currentTarget.value })}
              type="email"
              placeholder="new.player@example.com"
            />
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            Use player
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
