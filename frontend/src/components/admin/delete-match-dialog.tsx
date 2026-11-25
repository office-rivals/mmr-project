import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { MatchCard } from '@/components/match-card/match-card';
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
import { confirmsMatchScore, matchScoreLabel } from '@/lib/match-review';
import type { AdminMatchActionResult } from '@/lib/admin-match-actions';
import type { MatchResponse } from '@/api-v3';

export interface DeleteMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A snapshot taken on open, so the dialog keeps it while the list reloads. */
  match: MatchResponse | null;
  /** Resolves after the host has applied the result and refreshed its data. */
  onDelete: (input: {
    matchId: string;
    confirmation: string;
  }) => Promise<AdminMatchActionResult>;
}

export function DeleteMatchDialog({
  open,
  onOpenChange,
  match,
  onDelete,
}: DeleteMatchDialogProps) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A response only acts on the dialog that sent it, not on a reopened one.
  const generationRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    generationRef.current += 1;
    setTyped('');
    setError(null);
    setSubmitting(false);
  }, [open, match?.id]);

  const expected = match ? matchScoreLabel(match) : '';
  const confirmed = !!match && confirmsMatchScore(typed, match);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="delete-match-dialog">
        <DialogHeader>
          <DialogTitle>Delete this match?</DialogTitle>
          <DialogDescription>
            This can&apos;t be undone. The match, its rating changes and any
            reports on it are deleted.
          </DialogDescription>
        </DialogHeader>

        {match && (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!confirmed || submitting) return;
              const generation = generationRef.current;
              setSubmitting(true);
              setError(null);
              const result = await onDelete({
                matchId: match.id,
                confirmation: typed,
              });
              if (generation !== generationRef.current) return;
              setSubmitting(false);
              if (result.success) onOpenChange(false);
              else setError(result.message);
            }}
          >
            <MatchCard match={match} showMmr />

            <p className="text-sm text-muted-foreground">
              Players who haven&apos;t played since get back their rating from
              before this match. For everyone else, run Recalculate season on
              the Matches page afterwards.
            </p>

            <div className="space-y-2">
              <Label htmlFor="delete-match-confirmation">
                Type the score{' '}
                <span
                  className="font-mono font-semibold"
                  data-testid="delete-match-score"
                >
                  {expected}
                </span>{' '}
                to confirm
              </Label>
              <Input
                id="delete-match-confirmation"
                name="confirmation"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                data-testid="delete-match-confirmation"
              />
            </div>

            {error && <Alert variant="destructive">{error}</Alert>}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!confirmed || submitting}
                data-testid="delete-match-submit"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {submitting ? 'Deleting…' : 'Delete match'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
