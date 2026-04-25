<script lang="ts">
  import { enhance } from '$app/forms';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import MatchCard from '$lib/components/match-card/match-card.svelte';
  import {
    Flag,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Trash2,
    AlertCircle,
  } from 'lucide-svelte';
  import { Alert } from '$lib/components/ui/alert';
  import type { MatchFlagResponse, MatchResponse } from '$api3';

  interface Props {
    open: boolean;
    orgId: string;
    leagueId: string;
    seasonId?: string;
    leaguePlayerId?: string;
    userFlags: MatchFlagResponse[];
    onOpenChange?: (open: boolean) => void;
  }

  let {
    open = $bindable(false),
    orgId,
    leagueId,
    seasonId,
    leaguePlayerId,
    userFlags,
    onOpenChange,
  }: Props = $props();

  type Step = 'browse' | 'reason';

  let step = $state<Step>('browse');
  let matches = $state<MatchResponse[]>([]);
  let loading = $state(false);
  let fetchError = $state(false);
  let page = $state(0);
  let hasMore = $state(false);
  let selectedMatch = $state<MatchResponse | null>(null);
  let existingFlag = $state<MatchFlagResponse | undefined>(undefined);
  let reason = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let showDeleteConfirm = $state(false);
  let fetchRequestId = 0;
  let requestedPage = $state(0);

  const PAGE_SIZE = 10;

  const flagMap = $derived(
    new Map((userFlags ?? []).map((flag) => [flag.matchId, flag]))
  );

  $effect(() => {
    if (open) {
      step = 'browse';
      page = 0;
      requestedPage = 0;
      selectedMatch = null;
      existingFlag = undefined;
      reason = '';
      errorMessage = '';
      showDeleteConfirm = false;
      fetchMatches(0);
    }
  });

  async function fetchMatches(pageNum: number) {
    const requestId = ++fetchRequestId;
    requestedPage = pageNum;
    loading = true;
    fetchError = false;
    try {
      const params = new URLSearchParams();
      if (seasonId) params.set('seasonId', seasonId);
      if (leaguePlayerId) params.set('leaguePlayerId', leaguePlayerId);
      params.set('limit', String(PAGE_SIZE + 1));
      params.set('offset', String(pageNum * PAGE_SIZE));

      const response = await fetch(
        `/api/v3/organizations/${orgId}/leagues/${leagueId}/matches?${params}`
      );
      if (!response.ok) throw new Error('Failed to fetch matches');

      const data: MatchResponse[] = await response.json();
      if (requestId !== fetchRequestId) return;
      hasMore = data.length > PAGE_SIZE;
      matches = data.slice(0, PAGE_SIZE);
      page = pageNum;
    } catch (error) {
      if (requestId !== fetchRequestId) return;
      console.error('Failed to fetch matches:', error);
      matches = [];
      hasMore = false;
      fetchError = true;
    } finally {
      if (requestId === fetchRequestId) loading = false;
    }
  }

  function selectMatch(match: MatchResponse) {
    selectedMatch = match;
    const flag = flagMap.get(match.id);
    existingFlag = flag;
    reason = flag?.reason ?? '';
    errorMessage = '';
    showDeleteConfirm = false;
    step = 'reason';
  }

  function goBack() {
    step = 'browse';
    selectedMatch = null;
    existingFlag = undefined;
    reason = '';
    errorMessage = '';
    showDeleteConfirm = false;
  }

  const isEditMode = $derived(!!existingFlag);
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content class="max-h-[85vh] max-w-2xl overflow-y-auto">
    {#if step === 'browse'}
      <Dialog.Header>
        <Dialog.Title>Report a match</Dialog.Title>
        <Dialog.Description>
          Select a match to report an issue with its result.
        </Dialog.Description>
      </Dialog.Header>

      <div class="space-y-2 py-4">
        {#if loading}
          <div class="flex items-center justify-center py-8">
            <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        {:else if fetchError}
          <div class="flex flex-col items-center gap-2 py-8 text-center">
            <AlertCircle class="h-6 w-6 text-destructive" />
            <p class="text-sm text-muted-foreground">
              Failed to load matches. Please try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onclick={() => fetchMatches(requestedPage)}
            >
              Retry
            </Button>
          </div>
        {:else if matches.length === 0}
          <p class="py-8 text-center text-muted-foreground">No matches found</p>
        {:else}
          {#each matches as match (match.id)}
            <button
              type="button"
              class="w-full rounded-lg border border-border p-1 transition-colors hover:bg-accent"
              class:border-red-400={flagMap.has(match.id)}
              onclick={() => selectMatch(match)}
            >
              <div class="flex items-center gap-2">
                <div class="flex-1">
                  <MatchCard {match} showMmr={false} />
                </div>
                {#if flagMap.has(match.id)}
                  <Flag
                    class="mr-2 h-4 w-4 shrink-0 text-red-500"
                    fill="currentColor"
                  />
                {/if}
              </div>
            </button>
          {/each}
        {/if}
      </div>

      <div class="flex items-center justify-between border-t pt-4">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0 || loading}
          onclick={() => fetchMatches(page - 1)}
        >
          <ChevronLeft class="mr-1 h-4 w-4" />
          Previous
        </Button>
        <span class="text-sm text-muted-foreground">Page {page + 1}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore || loading}
          onclick={() => fetchMatches(page + 1)}
        >
          Next
          <ChevronRight class="ml-1 h-4 w-4" />
        </Button>
      </div>
    {:else if step === 'reason' && selectedMatch}
      <Dialog.Header>
        <Dialog.Title>{isEditMode ? 'Edit flag' : 'Report match'}</Dialog.Title>
        <Dialog.Description>
          {isEditMode
            ? 'Update or delete your flag for this match.'
            : 'Describe the issue with this match. A moderator will review your submission.'}
        </Dialog.Description>
      </Dialog.Header>

      {#if errorMessage}
        <Alert variant="destructive" class="mt-4">
          <div class="flex items-center gap-2">
            <AlertCircle class="h-4 w-4" />
            <span class="font-medium">{errorMessage}</span>
          </div>
        </Alert>
      {/if}

      <div class="py-4">
        <div class="pointer-events-none mb-4 rounded-lg border border-border p-1">
          <MatchCard match={selectedMatch} showMmr={false} />
        </div>

        <form
          method="POST"
          action={isEditMode ? '?/updateFlag' : '?/flagMatch'}
          use:enhance={() => {
            isSubmitting = true;
            errorMessage = '';
            return async ({ result, update }) => {
              isSubmitting = false;
              if (result.type === 'success') {
                await update();
                open = false;
              } else if (result.type === 'failure') {
                errorMessage =
                  (result.data?.message as string) ||
                  `Failed to ${isEditMode ? 'update' : 'create'} flag`;
              } else {
                await update();
              }
            };
          }}
        >
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="leagueId" value={leagueId} />
          {#if isEditMode && existingFlag}
            <input type="hidden" name="flagId" value={existingFlag.id} />
          {:else}
            <input type="hidden" name="matchId" value={selectedMatch.id} />
          {/if}

          <div class="space-y-2">
            <Label for="reason">Reason for flagging</Label>
            <textarea
              id="reason"
              name="reason"
              bind:value={reason}
              required
              maxlength={500}
              rows="4"
              class="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Describe why this match should be reviewed..."
            ></textarea>
            <p class="text-xs text-muted-foreground">
              {reason.length}/500 characters
            </p>
          </div>

          <Dialog.Footer class="mt-4 gap-2">
            <Button type="button" variant="ghost" onclick={goBack} disabled={isSubmitting}>
              <ChevronLeft class="mr-1 h-4 w-4" />
              Back
            </Button>
            <div class="flex-1"></div>
            {#if isEditMode}
              <Button
                type="button"
                variant="destructive"
                onclick={() => (showDeleteConfirm = true)}
                disabled={isSubmitting}
              >
                <Trash2 class="mr-1 h-4 w-4" />
                Delete
              </Button>
            {/if}
            <Button type="submit" disabled={isSubmitting || !reason.trim()}>
              <Flag class="mr-1 h-4 w-4" />
              {isSubmitting
                ? isEditMode
                  ? 'Updating...'
                  : 'Submitting...'
                : isEditMode
                  ? 'Update'
                  : 'Submit'}
            </Button>
          </Dialog.Footer>
        </form>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>

{#if isEditMode && existingFlag}
  <Dialog.Root bind:open={showDeleteConfirm}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Delete flag</Dialog.Title>
        <Dialog.Description>
          Are you sure you want to delete this flag? This action cannot be undone.
        </Dialog.Description>
      </Dialog.Header>
      <form
        method="POST"
        action="?/deleteFlag"
        use:enhance={() => {
          isSubmitting = true;
          return async ({ result, update }) => {
            isSubmitting = false;
            if (result.type === 'success') {
              await update();
              showDeleteConfirm = false;
              open = false;
            } else if (result.type === 'failure') {
              errorMessage =
                (result.data?.message as string) || 'Failed to delete flag';
              showDeleteConfirm = false;
            } else {
              await update();
            }
          };
        }}
      >
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="leagueId" value={leagueId} />
        <input type="hidden" name="flagId" value={existingFlag.id} />
        <Dialog.Footer class="gap-2">
          <Button
            type="button"
            variant="outline"
            onclick={() => (showDeleteConfirm = false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="destructive" disabled={isSubmitting}>
            {isSubmitting ? 'Deleting...' : 'Delete'}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{/if}
