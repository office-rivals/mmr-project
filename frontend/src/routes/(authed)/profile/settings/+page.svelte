<script lang="ts">
  import { enhance } from '$app/forms';
  import PageTitle from '$lib/components/page-title.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import CardContent from '$lib/components/ui/card/card-content.svelte';
  import CardHeader from '$lib/components/ui/card/card-header.svelte';
  import CardTitle from '$lib/components/ui/card/card-title.svelte';
  import Card from '$lib/components/ui/card/card.svelte';
  import { AlertCircle, Copy, Plus, Trash2 } from 'lucide-svelte';
  import type { ActionData, PageServerData } from './$types';

  interface Props {
    data: PageServerData;
    form: ActionData;
  }

  let { data, form }: Props = $props();
  let showCreateDialog = $state(false);
  let isCreating = $state(false);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function handleDeleteClick(event: Event) {
    if (
      !confirm(
        'Are you sure you want to revoke this token? This action cannot be undone.'
      )
    ) {
      event.preventDefault();
    }
  }
</script>

<div class="flex flex-col gap-6">
  <PageTitle>Settings</PageTitle>

  <Card>
    <CardHeader>
      <CardTitle>Personal Access Tokens</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="flex flex-col gap-4">
        <p class="text-muted-foreground text-sm">
          Personal access tokens allow you to authenticate with the API
          programmatically. Keep your tokens secure and never share them.
        </p>

        {#if form?.createdToken != null}
          <div
            class="border-primary flex flex-col gap-3 rounded-lg border border-l-4 bg-green-950/20 p-4"
          >
            <div class="flex items-start gap-2">
              <AlertCircle class="text-primary mt-0.5 shrink-0" size={20} />
              <div class="flex-1">
                <p class="text-primary font-semibold">Save your token now!</p>
                <p class="text-muted-foreground text-sm">
                  You won't be able to see this token again. Copy it now and
                  store it securely.
                </p>
              </div>
            </div>
            <div class="flex gap-2">
              <code
                class="bg-muted flex-1 overflow-x-auto rounded px-3 py-2 font-mono text-sm"
              >
                {form.createdToken.token}
              </code>
              <Button
                variant="outline"
                size="sm"
                onclick={() => copyToClipboard(form.createdToken.token)}
              >
                <Copy size={16} />
              </Button>
            </div>
          </div>
        {/if}

        {#if form?.error}
          <div
            class="flex items-start gap-2 rounded-lg border border-l-4 border-red-500 bg-red-950/20 p-4"
          >
            <AlertCircle class="mt-0.5 shrink-0 text-red-500" size={20} />
            <p class="text-sm text-red-500">{form.error}</p>
          </div>
        {/if}

        {#if !showCreateDialog}
          <Button onclick={() => (showCreateDialog = true)} class="w-fit">
            <Plus size={16} />
            Create New Token
          </Button>
        {:else}
          <form
            method="post"
            action="?/create"
            class="border-muted flex flex-col gap-4 rounded-lg border p-4"
            use:enhance={() => {
              isCreating = true;
              return async ({ update }) => {
                await update();
                isCreating = false;
                showCreateDialog = false;
              };
            }}
          >
            <div class="flex flex-col gap-2">
              <label for="token-name" class="text-sm font-medium"
                >Token Name</label
              >
              <input
                id="token-name"
                name="name"
                type="text"
                required
                placeholder="e.g., My API Token"
                class="border-input bg-background rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div class="flex flex-col gap-2">
              <label for="token-expiry" class="text-sm font-medium">
                Expiration (Optional)
              </label>
              <input
                id="token-expiry"
                name="expiresAt"
                type="datetime-local"
                class="border-input bg-background rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div class="flex gap-2">
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Token'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onclick={() => {
                  showCreateDialog = false;
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        {/if}

        {#if data.tokens.length > 0}
          <div class="border-muted mt-4 overflow-hidden rounded-lg border">
            <table class="w-full">
              <thead class="bg-muted/50 border-muted border-b">
                <tr>
                  <th class="px-4 py-3 text-left text-sm font-medium">Name</th>
                  <th class="px-4 py-3 text-left text-sm font-medium"
                    >Last Used</th
                  >
                  <th class="px-4 py-3 text-left text-sm font-medium"
                    >Expires</th
                  >
                  <th class="px-4 py-3 text-left text-sm font-medium"
                    >Created</th
                  >
                  <th class="px-4 py-3 text-right text-sm font-medium"
                    >Actions</th
                  >
                </tr>
              </thead>
              <tbody>
                {#each data.tokens as token}
                  <tr class="border-muted border-b last:border-0">
                    <td class="px-4 py-3 font-medium">{token.name}</td>
                    <td class="px-4 py-3 text-sm text-gray-400"
                      >{token.lastUsedAt?.toLocaleDateString()}</td
                    >
                    <td class="px-4 py-3 text-sm text-gray-400"
                      >{token.expiresAt?.toLocaleDateString()}</td
                    >
                    <td class="px-4 py-3 text-sm text-gray-400"
                      >{token.createdAt?.toLocaleDateString()}</td
                    >
                    <td class="px-4 py-3 text-right">
                      <form
                        method="post"
                        action="?/delete"
                        class="inline"
                        use:enhance
                      >
                        <input type="hidden" name="tokenId" value={token.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          onclick={handleDeleteClick}
                        >
                          <Trash2 size={16} />
                          Revoke
                        </Button>
                      </form>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if !showCreateDialog && !form?.createdToken}
          <p class="text-muted-foreground text-sm">
            You don't have any personal access tokens yet. Create one to get
            started.
          </p>
        {/if}
      </div>
    </CardContent>
  </Card>
</div>
