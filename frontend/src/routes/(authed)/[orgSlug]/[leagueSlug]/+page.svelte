<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import * as Table from '$lib/components/ui/table';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Alert } from '$lib/components/ui/alert';
  import { enhance } from '$app/forms';
  import { Flag, Trash2, CheckCircle, AlertCircle } from 'lucide-svelte';
  import type { PageData, ActionData } from './$types';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  let flagDialogOpen = $state(false);
  let flagMatchId = $state('');
  let flagReason = $state('');
  let editingFlagId = $state<string | null>(null);
  let deleteConfirmOpen = $state(false);

  const playerName = (leaguePlayerId: string) => {
    const player = data.players?.find(
      (p: { id: string }) => p.id === leaguePlayerId
    );
    return player?.displayName ?? player?.username ?? 'Unknown';
  };

  const myFlagForMatch = (matchId: string) => {
    return data.myFlags?.find(
      (f: { matchId: string }) => f.matchId === matchId
    );
  };

  function openFlagDialog(matchId: string) {
    const existing = myFlagForMatch(matchId);
    flagMatchId = matchId;
    if (existing) {
      editingFlagId = existing.id;
      flagReason = existing.reason;
    } else {
      editingFlagId = null;
      flagReason = '';
    }
    flagDialogOpen = true;
  }

  function closeFlagDialog() {
    flagDialogOpen = false;
    flagMatchId = '';
    flagReason = '';
    editingFlagId = null;
  }
</script>

<div class="flex flex-col gap-4">
  <PageTitle>Leaderboard</PageTitle>

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

  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head class="w-[3ch]">#</Table.Head>
        <Table.Head>Player</Table.Head>
        <Table.Head class="text-right">MMR</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each data.leaderboard?.entries ?? [] as entry}
        <Table.Row>
          <Table.Cell class="font-bold">{entry.rank}</Table.Cell>
          <Table.Cell>
            <a
              href="/{data.orgSlug}/{data.leagueSlug}/player/{entry.leaguePlayerId}"
              class="hover:underline"
            >
              {entry.displayName ?? entry.username ?? 'Unknown'}
            </a>
          </Table.Cell>
          <Table.Cell class="text-right">{entry.mmr ?? 'N/A'}</Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>

  {#if data.recentMatches?.length > 0}
    <h2 class="text-2xl md:text-4xl">Recent Matches</h2>
    <div class="flex flex-1 flex-col items-stretch gap-2">
      {#each data.recentMatches as match}
        {@const existingFlag = myFlagForMatch(match.id)}
        <div
          class="rounded-lg border bg-card p-3 {existingFlag
            ? 'border-red-400'
            : ''}"
        >
          <div class="flex items-center justify-between text-sm">
            {#each match.teams ?? [] as team}
              <div class="flex flex-col items-center gap-1">
                <span class="text-lg font-bold">{team.score}</span>
                {#each team.players ?? [] as player}
                  <a
                    href="/{data.orgSlug}/{data.leagueSlug}/player/{player.leaguePlayerId}"
                    class="hover:underline"
                  >
                    {player.displayName ?? player.username ?? 'Unknown'}
                  </a>
                {/each}
                {#if team.isWinner}
                  <span class="text-xs font-semibold text-primary">Winner</span>
                {/if}
              </div>
            {/each}
            <button
              class="ml-2 rounded p-1 transition-colors hover:bg-muted {existingFlag
                ? 'text-red-500'
                : 'text-muted-foreground'}"
              title={existingFlag ? 'Edit flag' : 'Flag this match'}
              onclick={() => openFlagDialog(match.id)}
            >
              <Flag class="h-4 w-4" />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<Dialog.Root bind:open={flagDialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>
        {editingFlagId ? 'Edit Flag' : 'Flag Match'}
      </Dialog.Title>
      <Dialog.Description>
        {editingFlagId
          ? 'Update or delete your flag for this match.'
          : 'Report an issue with this match.'}
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      {#if editingFlagId}
        <form
          method="POST"
          action="?/updateFlag"
          use:enhance={() => {
            return async ({ result, update }) => {
              await update();
              if (result.type === 'success') closeFlagDialog();
            };
          }}
        >
          <input type="hidden" name="flagId" value={editingFlagId} />
          <input type="hidden" name="orgId" value={data.orgId} />
          <input type="hidden" name="leagueId" value={data.leagueId} />
          <div class="space-y-2">
            <label for="reason" class="text-sm font-medium">Reason</label>
            <textarea
              id="reason"
              name="reason"
              bind:value={flagReason}
              rows="3"
              maxlength="500"
              class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Describe the issue..."
            ></textarea>
            <p class="text-xs text-muted-foreground">
              {flagReason.length}/500
            </p>
          </div>
          <Dialog.Footer class="mt-4 gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onclick={() => (deleteConfirmOpen = true)}
            >
              <Trash2 class="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
            <Button type="button" variant="outline" onclick={closeFlagDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={!flagReason.trim()}>
              Update Flag
            </Button>
          </Dialog.Footer>
        </form>
      {:else}
        <form
          method="POST"
          action="?/flagMatch"
          use:enhance={() => {
            return async ({ result, update }) => {
              await update();
              if (result.type === 'success') closeFlagDialog();
            };
          }}
        >
          <input type="hidden" name="matchId" value={flagMatchId} />
          <input type="hidden" name="orgId" value={data.orgId} />
          <input type="hidden" name="leagueId" value={data.leagueId} />
          <div class="space-y-2">
            <label for="reason" class="text-sm font-medium">Reason</label>
            <textarea
              id="reason"
              name="reason"
              bind:value={flagReason}
              rows="3"
              maxlength="500"
              class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Describe the issue..."
            ></textarea>
            <p class="text-xs text-muted-foreground">
              {flagReason.length}/500
            </p>
          </div>
          <Dialog.Footer class="mt-4 gap-2">
            <Button type="button" variant="outline" onclick={closeFlagDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={!flagReason.trim()}>
              <Flag class="mr-1 h-3.5 w-3.5" />
              Flag Match
            </Button>
          </Dialog.Footer>
        </form>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={deleteConfirmOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Delete Flag</Dialog.Title>
      <Dialog.Description>
        Are you sure you want to delete this flag? This action cannot be undone.
      </Dialog.Description>
    </Dialog.Header>
    <form
      method="POST"
      action="?/deleteFlag"
      use:enhance={() => {
        return async ({ result, update }) => {
          await update();
          if (result.type === 'success') {
            deleteConfirmOpen = false;
            closeFlagDialog();
          }
        };
      }}
    >
      <input type="hidden" name="flagId" value={editingFlagId} />
      <input type="hidden" name="orgId" value={data.orgId} />
      <input type="hidden" name="leagueId" value={data.leagueId} />
      <Dialog.Footer class="gap-2">
        <Button
          type="button"
          variant="outline"
          onclick={() => (deleteConfirmOpen = false)}>Cancel</Button
        >
        <Button type="submit" variant="destructive">Delete Flag</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
