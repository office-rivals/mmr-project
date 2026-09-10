import { AcceptanceStatus } from '@/api-v3';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  PendingMatchAcceptanceResponse,
  PendingMatchResponse,
} from '@/api-v3';

interface PendingMatchDialogProps {
  open: boolean;
  pendingMatch: PendingMatchResponse | undefined;
  myAcceptance: PendingMatchAcceptanceResponse | undefined;
  secondsRemaining: number;
  responding: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

function acceptanceLabel(
  acceptance: PendingMatchAcceptanceResponse | undefined
) {
  if (acceptance?.status === AcceptanceStatus.Accepted) return '✅ accepted';
  if (acceptance?.status === AcceptanceStatus.Declined) return '❌ declined';
  return '⌛ pending';
}

export function PendingMatchDialog({
  open,
  pendingMatch,
  myAcceptance,
  secondsRemaining,
  responding,
  onAccept,
  onDecline,
}: PendingMatchDialogProps) {
  // Queue polling owns this dialog's open state.
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Match found!</DialogTitle>
          <DialogDescription>
            {`Accept within ${secondsRemaining}s`}
          </DialogDescription>
        </DialogHeader>

        {pendingMatch ? (
          <>
            <div className="space-y-3">
              {pendingMatch.teams.map((team, idx) => (
                <div className="flex flex-col gap-1" key={team.index}>
                  <p className="text-sm text-muted-foreground">
                    {`Team ${idx + 1}`}
                  </p>
                  {team.players.map((player) => (
                    <div
                      className="flex justify-between text-sm"
                      key={player.leaguePlayerId}
                    >
                      <span>
                        {player.displayName ?? player.username ?? 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {acceptanceLabel(
                          pendingMatch.acceptances.find(
                            (a) => a.leaguePlayerId === player.leaguePlayerId
                          )
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              {myAcceptance?.status === AcceptanceStatus.Pending ? (
                <>
                  <form
                    className="flex-1"
                    onSubmit={(event) => {
                      event.preventDefault();
                      onAccept();
                    }}
                  >
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={responding}
                    >
                      Accept
                    </Button>
                  </form>
                  <form
                    className="flex-1"
                    onSubmit={(event) => {
                      event.preventDefault();
                      onDecline();
                    }}
                  >
                    <Button
                      type="submit"
                      variant="destructive"
                      className="w-full"
                      disabled={responding}
                    >
                      Decline
                    </Button>
                  </form>
                </>
              ) : myAcceptance?.status === AcceptanceStatus.Accepted ? (
                <p className="flex-1 text-sm">Waiting for other players...</p>
              ) : (
                <p className="flex-1 text-sm text-muted-foreground">
                  Acceptance recorded.
                </p>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
