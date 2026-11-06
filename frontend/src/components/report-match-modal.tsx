import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
  Trash2,
} from 'lucide-react';
import { MatchCard } from '@/components/match-card';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { FlagActionResult } from '@/lib/match-flag-actions';
import type { MatchFlagResponse, MatchResponse } from '@/api-v3';

export interface ReportMatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  leagueId: string;
  seasonId?: string;
  leaguePlayerId?: string;
  userFlags: MatchFlagResponse[];
  onCreateFlag: (input: {
    matchId: string;
    reason: string;
  }) => Promise<FlagActionResult>;
  onUpdateFlag: (input: {
    flagId: string;
    reason: string;
  }) => Promise<FlagActionResult>;
  onDeleteFlag: (input: { flagId: string }) => Promise<FlagActionResult>;
}

type Step = 'browse' | 'reason';

const PAGE_SIZE = 10;

export function ReportMatchModal({
  open,
  onOpenChange,
  orgId,
  leagueId,
  seasonId,
  leaguePlayerId,
  userFlags,
  onCreateFlag,
  onUpdateFlag,
  onDeleteFlag,
}: ReportMatchModalProps) {
  const [step, setStep] = useState<Step>('browse');
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchResponse | null>(
    null
  );
  const [existingFlag, setExistingFlag] = useState<
    MatchFlagResponse | undefined
  >(undefined);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [requestedPage, setRequestedPage] = useState(0);
  const browseContentRef = useRef<HTMLDivElement>(null);
  // Last-write-wins guard: a slow page-1 response must not overwrite page 2.
  const fetchRequestId = useRef(0);

  const flagMap = useMemo(
    () => new Map((userFlags ?? []).map((flag) => [flag.matchId, flag])),
    [userFlags]
  );

  const fetchMatches = useCallback(
    async (pageNum: number) => {
      const requestId = ++fetchRequestId.current;
      setRequestedPage(pageNum);
      setLoading(true);
      setFetchError(false);
      try {
        const params = new URLSearchParams();
        if (seasonId) params.set('seasonId', seasonId);
        if (leaguePlayerId) params.set('leaguePlayerId', leaguePlayerId);
        // Over-fetch by one: that extra row is the has-more probe.
        params.set('limit', String(PAGE_SIZE + 1));
        params.set('offset', String(pageNum * PAGE_SIZE));

        const response = await fetch(
          `/api/v3/organizations/${orgId}/leagues/${leagueId}/matches?${params}`
        );
        if (!response.ok) throw new Error('Failed to fetch matches');

        const data: MatchResponse[] = await response.json();
        if (requestId !== fetchRequestId.current) return;
        setHasMore(data.length > PAGE_SIZE);
        setMatches(data.slice(0, PAGE_SIZE));
        setPage(pageNum);
      } catch (error) {
        if (requestId !== fetchRequestId.current) return;
        console.error('Failed to fetch matches:', error);
        setMatches([]);
        setHasMore(false);
        setFetchError(true);
      } finally {
        if (requestId === fetchRequestId.current) setLoading(false);
      }
    },
    [orgId, leagueId, seasonId, leaguePlayerId]
  );

  // Opening always resets to a fresh browse step and refetches page 0.
  useEffect(() => {
    if (!open) return;
    setStep('browse');
    setPage(0);
    setRequestedPage(0);
    setSelectedMatch(null);
    setExistingFlag(undefined);
    setReason('');
    setErrorMessage('');
    setShowDeleteConfirm(false);
    void fetchMatches(0);
  }, [open, fetchMatches]);

  const selectMatch = (match: MatchResponse) => {
    const flag = flagMap.get(match.id);
    setSelectedMatch(match);
    setExistingFlag(flag);
    setReason(flag?.reason ?? '');
    setErrorMessage('');
    setShowDeleteConfirm(false);
    setStep('reason');
  };

  const goBack = () => {
    setStep('browse');
    setSelectedMatch(null);
    setExistingFlag(undefined);
    setReason('');
    setErrorMessage('');
    setShowDeleteConfirm(false);
  };

  const isEditMode = !!existingFlag;

  const submitReason = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMatch) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const result =
        isEditMode && existingFlag
          ? await onUpdateFlag({ flagId: existingFlag.id, reason })
          : await onCreateFlag({ matchId: selectedMatch.id, reason });
      if (result.success) {
        onOpenChange(false);
      } else {
        setErrorMessage(
          result.message || `Failed to ${isEditMode ? 'update' : 'create'} flag`
        );
      }
    } catch {
      setErrorMessage(`Failed to ${isEditMode ? 'update' : 'create'} flag`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDelete = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!existingFlag) return;
    setIsSubmitting(true);
    try {
      const result = await onDeleteFlag({ flagId: existingFlag.id });
      if (result.success) {
        setShowDeleteConfirm(false);
        onOpenChange(false);
      } else {
        setErrorMessage(result.message || 'Failed to delete flag');
        setShowDeleteConfirm(false);
      }
    } catch {
      setErrorMessage('Failed to delete flag');
      setShowDeleteConfirm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          ref={browseContentRef}
          tabIndex={-1}
          className="max-h-[85vh] max-w-2xl overflow-y-auto focus:outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            browseContentRef.current?.focus();
          }}
        >
          {step === 'browse' ? (
            <>
              <DialogHeader>
                <DialogTitle>Report a match</DialogTitle>
                <DialogDescription>
                  Select a match to report an issue with its result.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 py-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : fetchError ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    <p className="text-sm text-muted-foreground">
                      Failed to load matches. Please try again.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void fetchMatches(requestedPage)}
                    >
                      Retry
                    </Button>
                  </div>
                ) : matches.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">
                    No matches found
                  </p>
                ) : (
                  matches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      className={cn(
                        'w-full rounded-lg border border-border p-1 transition-colors hover:bg-accent',
                        flagMap.has(match.id) && 'border-red-400'
                      )}
                      onClick={() => selectMatch(match)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <MatchCard match={match} showMmr={false} />
                        </div>
                        {flagMap.has(match.id) ? (
                          <Flag
                            className="mr-2 h-4 w-4 shrink-0 text-red-500"
                            fill="currentColor"
                          />
                        ) : null}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || loading}
                  onClick={() => void fetchMatches(page - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore || loading}
                  onClick={() => void fetchMatches(page + 1)}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </>
          ) : null}

          {step === 'reason' && selectedMatch ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {isEditMode ? 'Edit flag' : 'Report match'}
                </DialogTitle>
                <DialogDescription>
                  {isEditMode
                    ? 'Update or delete your flag for this match.'
                    : 'Describe the issue with this match. A moderator will review your submission.'}
                </DialogDescription>
              </DialogHeader>

              {errorMessage ? (
                <Alert variant="destructive" className="mt-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">{errorMessage}</span>
                  </div>
                </Alert>
              ) : null}

              <div className="py-4">
                <div className="pointer-events-none mb-4 rounded-lg border border-border p-1">
                  <MatchCard match={selectedMatch} showMmr={false} />
                </div>

                <form onSubmit={submitReason}>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for flagging</Label>
                    <Textarea
                      id="reason"
                      name="reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      required
                      maxLength={500}
                      rows={4}
                      className="min-h-[100px]"
                      placeholder="Describe why this match should be reviewed..."
                    />
                    <p className="text-xs text-muted-foreground">
                      {`${reason.length}/500 characters`}
                    </p>
                  </div>

                  <DialogFooter className="mt-4 gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={goBack}
                      disabled={isSubmitting}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Back
                    </Button>
                    <div className="flex-1" />
                    {isEditMode ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    ) : null}
                    <Button
                      type="submit"
                      disabled={isSubmitting || !reason.trim()}
                    >
                      <Flag className="mr-1 h-4 w-4" />
                      {isSubmitting
                        ? isEditMode
                          ? 'Updating...'
                          : 'Submitting...'
                        : isEditMode
                          ? 'Update'
                          : 'Submit'}
                    </Button>
                  </DialogFooter>
                </form>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {isEditMode && existingFlag ? (
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete flag</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this flag? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitDelete}>
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
