<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import { enhance } from '$app/forms';
  import { Button } from '$lib/components/ui/button';
  import { Alert } from '$lib/components/ui/alert';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Label } from '$lib/components/ui/label';
  import * as Table from '$lib/components/ui/table';
  import { Flag, CheckCircle, AlertCircle, XCircle } from 'lucide-svelte';
  import { page } from '$app/stores';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let selectedFlagId = $state<string | null>(null);
  let dialogOpen = $state(false);
  let resolutionNote = $state('');
  let resolveStatus = $state('Resolved');

  const selectedFlag = $derived(
    data.flags?.find((f: { id: string }) => f.id === selectedFlagId)
  );

  function handleResolve(flagId: string) {
    selectedFlagId = flagId;
    resolutionNote = '';
    resolveStatus = 'Resolved';
    dialogOpen = true;
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '...' : text;
  }

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
      Review and resolve match flags reported by users
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
    <div class="rounded-lg border border-border">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Flagged By</Table.Head>
            <Table.Head>Reason</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Date</Table.Head>
            <Table.Head class="text-right">Actions</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each data.flags as flag (flag.id)}
            <Table.Row>
              <Table.Cell class="whitespace-nowrap font-medium">
                {flag.flaggedByDisplayName ?? 'Unknown'}
              </Table.Cell>
              <Table.Cell class="max-w-[300px]">
                <span class="text-sm" title={flag.reason}>
                  {truncate(flag.reason, 80)}
                </span>
              </Table.Cell>
              <Table.Cell>
                {#if flag.status === 'Open'}
                  <span
                    class="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  >
                    <Flag class="mr-1 h-3 w-3" />
                    Open
                  </span>
                {:else if flag.status === 'Resolved'}
                  <span
                    class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
                  >
                    <CheckCircle class="mr-1 h-3 w-3" />
                    Resolved
                  </span>
                {:else}
                  <span
                    class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <XCircle class="mr-1 h-3 w-3" />
                    Dismissed
                  </span>
                {/if}
              </Table.Cell>
              <Table.Cell class="whitespace-nowrap text-sm">
                {formatDate(flag.createdAt)}
              </Table.Cell>
              <Table.Cell class="text-right">
                {#if flag.status === 'Open'}
                  <Button size="sm" onclick={() => handleResolve(flag.id)}>
                    <CheckCircle class="mr-1 h-3.5 w-3.5" />
                    Resolve
                  </Button>
                {:else}
                  <span class="text-xs text-muted-foreground">
                    {flag.resolvedByDisplayName
                      ? `by ${flag.resolvedByDisplayName}`
                      : ''}
                  </span>
                {/if}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
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
