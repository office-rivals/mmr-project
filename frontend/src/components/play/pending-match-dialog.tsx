import { Fragment } from 'react';
import { Check, Hourglass, X } from 'lucide-react';
import { AcceptanceStatus } from '@/api-v3';
import { Eyebrow } from '@/components/eyebrow';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, getPlayerDisplayName } from '@/lib/utils';
import type {
  PendingMatchAcceptanceResponse,
  PendingMatchResponse,
  PendingMatchTeamResponse,
} from '@/api-v3';

interface PendingMatchDialogProps {
  open: boolean;
  pendingMatch: PendingMatchResponse | undefined;
  myAcceptance: PendingMatchAcceptanceResponse | undefined;
  secondsRemaining: number;
  responding: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /** Puts the viewer's team first and names them "You". */
  leaguePlayerId?: string | null;
  formatLabel?: string;
}

// The acceptance window the matchmaking page promises; drives the ring.
const ACCEPT_WINDOW_SECONDS = 30;

function AcceptanceIcon({
  acceptance,
}: {
  acceptance: PendingMatchAcceptanceResponse | undefined;
}) {
  if (acceptance?.status === AcceptanceStatus.Accepted) {
    return (
      <span className="flex items-center text-green-400">
        <Check aria-hidden="true" className="size-4" />
        <span className="sr-only">accepted</span>
      </span>
    );
  }
  if (acceptance?.status === AcceptanceStatus.Declined) {
    return (
      <span className="flex items-center text-red-400">
        <X aria-hidden="true" className="size-4" />
        <span className="sr-only">declined</span>
      </span>
    );
  }
  return (
    <span className="flex items-center text-muted-foreground">
      <Hourglass aria-hidden="true" className="size-3.5" />
      <span className="sr-only">pending</span>
    </span>
  );
}

function CountdownRing({ seconds }: { seconds: number }) {
  const circumference = 2 * Math.PI * 44;
  const share = Math.max(0, Math.min(1, seconds / ACCEPT_WINDOW_SECONDS));
  return (
    <span aria-hidden="true" className="relative flex size-28 shrink-0">
      <svg viewBox="0 0 100 100" className="size-28 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          strokeWidth="6"
          className="stroke-muted"
        />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${share * circumference} ${circumference}`}
          className="stroke-primary transition-[stroke-dasharray] duration-300"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl leading-none font-bold tabular-nums">
          {seconds}
        </span>
        <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          sec
        </span>
      </span>
    </span>
  );
}

export function PendingMatchDialog({
  open,
  pendingMatch,
  myAcceptance,
  secondsRemaining,
  responding,
  onAccept,
  onDecline,
  leaguePlayerId,
  formatLabel,
}: PendingMatchDialogProps) {
  const isMine = (team: PendingMatchTeamResponse) =>
    leaguePlayerId != null &&
    team.players.some((p) => p.leaguePlayerId === leaguePlayerId);
  const teams = [...(pendingMatch?.teams ?? [])].sort(
    (a, b) => Number(isMine(b)) - Number(isMine(a)) || a.index - b.index
  );
  const teamLabel = (team: PendingMatchTeamResponse, idx: number) => {
    if (teams.some(isMine)) return isMine(team) ? 'Your team' : 'Opponents';
    return `Team ${idx + 1}`;
  };

  // Queue polling owns this dialog's open state.
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        hideCloseButton
        className="max-w-[calc(100%-2rem)] gap-6 rounded-xl border-primary/40 sm:max-w-md sm:p-8"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-1">
            {formatLabel ? <Eyebrow>{formatLabel}</Eyebrow> : null}
            <DialogTitle className="text-4xl font-bold text-primary">
              Match found!
            </DialogTitle>
            {/* The ring shows the countdown visually. */}
            <DialogDescription className="sr-only">
              {`Accept within ${secondsRemaining}s`}
            </DialogDescription>
          </div>
          <CountdownRing seconds={secondsRemaining} />
        </div>

        {pendingMatch ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2">
              {teams.map((team, idx) => (
                <Fragment key={team.index}>
                  {idx > 0 ? (
                    <span className="self-center text-xs text-muted-foreground">
                      vs
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      'flex min-w-0 flex-col gap-2 rounded-lg border p-3',
                      isMine(team)
                        ? 'border-primary/50 bg-primary/10'
                        : 'bg-card'
                    )}
                  >
                    <p
                      className={cn(
                        'text-[10px] font-semibold tracking-[0.14em] uppercase',
                        isMine(team) ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      {teamLabel(team, idx)}
                    </p>
                    {team.players.map((player) => (
                      <div
                        className="flex items-center justify-between gap-2 text-sm"
                        key={player.leaguePlayerId}
                      >
                        <span className="truncate font-semibold">
                          {player.leaguePlayerId === leaguePlayerId
                            ? 'You'
                            : getPlayerDisplayName(player)}
                        </span>
                        <AcceptanceIcon
                          acceptance={pendingMatch.acceptances.find(
                            (a) => a.leaguePlayerId === player.leaguePlayerId
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </Fragment>
              ))}
            </div>

            {myAcceptance?.status === AcceptanceStatus.Pending ? (
              <div className="flex flex-col gap-1">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    onAccept();
                  }}
                >
                  <Button
                    type="submit"
                    className="h-12 w-full text-base font-bold"
                    disabled={responding}
                  >
                    Accept
                  </Button>
                </form>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    onDecline();
                  }}
                >
                  <Button
                    type="submit"
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    disabled={responding}
                  >
                    Decline
                  </Button>
                </form>
              </div>
            ) : myAcceptance?.status === AcceptanceStatus.Accepted ? (
              <p className="text-center text-sm">
                Waiting for other players...
              </p>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Acceptance recorded.
              </p>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
