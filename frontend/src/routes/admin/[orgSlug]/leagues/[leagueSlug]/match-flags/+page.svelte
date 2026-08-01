<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import { enhance } from '$app/forms';
  import { Button } from '$lib/components/ui/button';
  import { Alert } from '$lib/components/ui/alert';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Label } from '$lib/components/ui/label';
  import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import MatchCard from '$lib/components/match-card/match-card.svelte';
  import EditMatchDialog from '$lib/components/admin/edit-match-dialog.svelte';
  import {
    Flag,
    CheckCircle,
    AlertCircle,
    XCircle,
    Pencil,
    RefreshCw,
  } from 'lucide-svelte';
  import { page } from '$app/stores';
  import { formatDate } from '$lib/utils';
  import type { MatchResponse, MatchFlagStatus } from '$api3';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let selectedFlagId = $state<string | null>(null);
  let dialogOpen = $state(false);
  let resolutionNote = $state('');
  let resolveStatus = $state('Resolved');

  let editing = $state<MatchResponse | null>(null);
  let editDialogOpen = $state(false);

  const selectedFlag = $derived(
    data.flags?.find((f: { id: string }) => f.id === selectedFlagId)
  );
  const selectedMatch = $derived(
    selectedFlag ? (data.matchesById[selectedFlag.matchId] ?? null) : null
  );

  function handleResolve(flagId: string) {
    selectedFlagId = flagId;
    resolutionNote = '';
    resolveStatus = 'Resolved';
    dialogOpen = true;
  }

  function openEdit(match: MatchResponse) {
    editing = match;
    editDialogOpen = true;
  }

  const dateOpts = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  } as const;

  const STATUS_META: Record<
    MatchFlagStatus,
    { label: string; icon: typeof Flag; class: string }
  > = {
    Open: {
      label: 'Open',
      icon: Flag,
      class:
        'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    },
    Resolved: {
      label: 'Resolved',
      icon: CheckCircle,
      class:
        'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    Dismissed: {
      label: 'Dismissed',
      icon: XCircle,
      class:
        'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    },
  };

  const statusTabs = [
    { label: 'All', value: null },
    { label: 'Open', value: 'Open' },
    { label: 'Resolved', value: 'Resolved' },
    { label: 'Dismissed', value: 'Dismissed' },
  ];

  const currentUrl = $derived($page.url);
  const basePath = $derived(currentUrl.pathname);
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-3xl font-bold tracking-tight">Flagged Matches</h1>
    <p class="text-muted-foreground">
      Review the flagged match, correct it if needed, then resolve or dismiss
      the flag. Editing a match leaves rating history untouched — recalculate to
      flow the correction through to the leaderboard.
    </p>
  </div>

  {#if form?.success && form.message}
    <Alert variant="default">
      <div class="flex items-center gap-2">
        <CheckCircle class="h-4 w-4" />
        <span class="font-medium">{form.message}</span>
      </div>
    </Alert>
  {:else if form?.success === false}
    <Alert variant="destructive">
      <div class="flex items-center gap-2">
        <AlertCircle class="h-4 w-4" />
        <span class="font-medium">{form?.message}</span>
      </div>
    </Alert>
  {/if}

  <div class="flex gap-2">
    {#each statusTabs as tab}
      {@const isActive =
        tab.value === data.statusFilter ||
        (tab.value === null && !data.statusFilter)}
      <a
        href={tab.value ? `${basePath}?status=${tab.value}` : basePath}
        class="rounded-md border px-3 py-1.5 text-sm transition-colors {isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted hover:bg-accent'}"
      >
        {tab.label}
      </a>
    {/each}
  </div>

  {#if data.flags.length === 0}
    <div
      class="flex flex-col items-center justify-center rounded-lg border border-border py-12 text-center"
    >
      <CheckCircle class="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 class="text-lg font-medium">No flags found</h3>
      <p class="text-sm text-muted-foreground">
        {data.statusFilter
          ? `No ${data.statusFilter.toLowerCase()} flags`
          : 'All match flags have been resolved'}
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each data.flags as flag (flag.id)}
        {@const match = data.matchesById[flag.matchId] ?? null}
        {@const isCurrentSeason =
          !!match &&
          data.currentSeasonId != null &&
          match.seasonId === data.currentSeasonId}
        {@const statusMeta = STATUS_META[flag.status]}
        {@const StatusIcon = statusMeta.icon}
        <Card data-testid="match-flag-card" data-flag-id={flag.id}>
          <CardHeader
            class="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0"
          >
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <Badge variant="outline" class={statusMeta.class}>
                  <StatusIcon class="mr-1 h-3 w-3" />
                  {statusMeta.label}
                </Badge>
                <span class="text-sm text-muted-foreground">
                  Flagged by {flag.flaggedByDisplayName ?? 'Unknown'}
                  on {formatDate(flag.createdAt, '—', dateOpts)}
                </span>
              </div>
            </div>

            {#if flag.status === 'Open'}
              <div class="flex flex-wrap items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isCurrentSeason}
                  onclick={() => match && openEdit(match)}
                  data-testid="match-flag-edit"
                >
                  <Pencil class="mr-1 h-3.5 w-3.5" />
                  Edit match
                </Button>
                <form method="POST" action="?/recalculate" use:enhance>
                  <input
                    type="hidden"
                    name="fromMatchId"
                    value={flag.matchId}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={!isCurrentSeason}
                    data-testid="match-flag-recalculate"
                    onclick={(event) => {
                      if (
                        !confirm(
                          'Replay every match from this one to the end of the season?'
                        )
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <RefreshCw class="mr-1 h-3.5 w-3.5" />
                    Recalc
                  </Button>
                </form>
                <Button
                  size="sm"
                  onclick={() => handleResolve(flag.id)}
                  data-testid="match-flag-resolve"
                >
                  <CheckCircle class="mr-1 h-3.5 w-3.5" />
                  Resolve
                </Button>
              </div>
            {/if}
          </CardHeader>

          <CardContent class="space-y-3">
            {#if match}
              <MatchCard {match} showMmr />
            {:else}
              <div
                class="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground"
              >
                This match no longer exists — it may have been deleted.
              </div>
            {/if}

            {#if flag.status === 'Open' && match && !isCurrentSeason}
              <p class="text-xs text-muted-foreground">
                This match is in a past season, so it can't be edited or
                recalculated — resolve or dismiss the flag instead.
              </p>
            {/if}

            <div class="space-y-1 rounded-md border border-border p-3">
              <span class="text-sm font-medium text-muted-foreground">
                Reason
              </span>
              <p class="whitespace-pre-wrap text-sm">{flag.reason}</p>
            </div>

            {#if flag.status !== 'Open'}
              <div class="text-sm text-muted-foreground">
                <span>
                  {flag.status === 'Resolved'
                    ? 'Resolved'
                    : 'Dismissed'}{flag.resolvedByDisplayName
                    ? ` by ${flag.resolvedByDisplayName}`
                    : ''}{flag.resolvedAt
                    ? ` on ${formatDate(flag.resolvedAt, '—', dateOpts)}`
                    : ''}
                </span>
                {#if flag.resolutionNote}
                  <p class="mt-1 italic">“{flag.resolutionNote}”</p>
                {/if}
              </div>
            {/if}
          </CardContent>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Resolve Match Flag</Dialog.Title>
      <Dialog.Description>
        Mark this flag as resolved or dismissed with an optional note.
      </Dialog.Description>
    </Dialog.Header>

    {#if selectedFlag}
      <div class="space-y-4 py-4">
        {#if selectedMatch}
          <MatchCard match={selectedMatch} />
        {/if}

        <div class="space-y-2 rounded-lg border border-border p-3">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-muted-foreground"
              >Flagged by:</span
            >
            <span class="text-sm"
              >{selectedFlag.flaggedByDisplayName ?? 'Unknown'}</span
            >
          </div>
          <div class="space-y-1">
            <span class="text-sm font-medium text-muted-foreground"
              >Reason:</span
            >
            <p class="text-sm">{selectedFlag.reason}</p>
          </div>
        </div>

        <form
          method="POST"
          action="?/resolve"
          use:enhance={() => {
            return async ({ result, update }) => {
              await update();
              if (result.type === 'success') {
                dialogOpen = false;
                selectedFlagId = null;
                resolutionNote = '';
              }
            };
          }}
        >
          <input type="hidden" name="flagId" value={selectedFlag.id} />
          <input type="hidden" name="status" value={resolveStatus} />
          <input type="hidden" name="orgId" value={data.orgId} />
          <input type="hidden" name="leagueId" value={data.leagueId} />

          <div class="space-y-4">
            <div class="space-y-2">
              <Label>Resolution</Label>
              <div class="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={resolveStatus === 'Resolved' ? 'default' : 'outline'}
                  onclick={() => (resolveStatus = 'Resolved')}
                >
                  <CheckCircle class="mr-1 h-3.5 w-3.5" />
                  Resolve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={resolveStatus === 'Dismissed'
                    ? 'default'
                    : 'outline'}
                  onclick={() => (resolveStatus = 'Dismissed')}
                >
                  <XCircle class="mr-1 h-3.5 w-3.5" />
                  Dismiss
                </Button>
              </div>
            </div>

            <div class="space-y-2">
              <Label for="note">Resolution Note (Optional)</Label>
              <textarea
                id="note"
                name="note"
                bind:value={resolutionNote}
                rows="3"
                class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Add a note about why this flag was resolved..."
              ></textarea>
            </div>
          </div>

          <Dialog.Footer class="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onclick={() => {
                dialogOpen = false;
                selectedFlagId = null;
                resolutionNote = '';
              }}
            >
              Cancel
            </Button>
            <Button type="submit">
              {resolveStatus === 'Resolved' ? 'Resolve' : 'Dismiss'} Flag
            </Button>
          </Dialog.Footer>
        </form>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<EditMatchDialog
  open={editDialogOpen}
  onOpenChange={(value) => (editDialogOpen = value)}
  match={editing}
  leaguePlayers={data.players}
/>
