<script lang="ts">
  import { enhance } from '$app/forms';
  import PageTitle from '$lib/components/page-title.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import CardContent from '$lib/components/ui/card/card-content.svelte';
  import CardHeader from '$lib/components/ui/card/card-header.svelte';
  import CardTitle from '$lib/components/ui/card/card-title.svelte';
  import Card from '$lib/components/ui/card/card.svelte';
  import {
    AlertCircle,
    Check,
    Copy,
    Plus,
    Radio,
    Trash2,
    Unlink,
  } from 'lucide-svelte';
  import type { ActionData, PageData } from './$types';
  import { formatDate, formatDateTime } from '$lib/utils';
  import { PairingColor } from '$api3/models';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();
  let showCreateDialog = $state(false);
  let isCreating = $state(false);
  let copySuccess = $state(false);
  let isIssuingPairingCode = $state(false);

  const pairingColorClasses: Record<PairingColor, string> = {
    [PairingColor.Red]: 'bg-red-500',
    [PairingColor.Green]: 'bg-green-500',
    [PairingColor.Blue]: 'bg-blue-500',
    [PairingColor.Yellow]: 'bg-yellow-400',
  };

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copySuccess = true;
      setTimeout(() => (copySuccess = false), 2000);
    } catch {
      alert('Failed to copy to clipboard. Please copy manually.');
    }
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

  function handleUnlinkClick(event: Event) {
    if (
      !confirm(
        'Are you sure you want to unlink this RFID tag? You can pair it again later.'
      )
    ) {
      event.preventDefault();
    }
  }
</script>

<div class="flex flex-col gap-6">
  <PageTitle>Settings</PageTitle>

  <Card id="pairing">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Radio class="h-5 w-5" />
        RFID pairing
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted-foreground">
          Pair an RFID tag with your player profile for use with hardware.
        </p>

        {#if form?.pairingError}
          <div
            class="flex items-start gap-2 rounded-lg border border-l-4 border-red-500 bg-red-950/20 p-4"
          >
            <AlertCircle class="mt-0.5 shrink-0 text-red-500" size={20} />
            <p class="text-sm text-red-500">{form.pairingError}</p>
          </div>
        {/if}

        {#if form?.pairingCode}
          <div
            class="flex flex-col gap-3 rounded-lg border border-primary/50 bg-primary/5 p-4"
            aria-live="polite"
          >
            <div class="flex items-center gap-2">
              <Check class="h-5 w-5 text-primary" />
              <p class="font-semibold">Pairing code</p>
            </div>
            <p class="text-sm text-muted-foreground">
              Generate the code here, then press Link on the randomizer. When
              the ring animation starts, scan your RFID tag and enter the colors
              in order with buttons 1–4: red, green, blue, yellow.
            </p>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {#each form.pairingCode.colors as color, index (index)}
                <div
                  class="flex items-center gap-2 rounded-md border bg-background px-3 py-2"
                >
                  <span
                    class={`h-4 w-4 shrink-0 rounded-full ${pairingColorClasses[color]}`}
                    aria-hidden="true"
                  ></span>
                  <span class="text-sm font-medium">{index + 1}. {color}</span>
                </div>
              {/each}
            </div>
            <p class="text-xs text-muted-foreground">
              Expires {formatDateTime(form.pairingCode.expiresAt)}
            </p>
          </div>
        {/if}

        <form
          method="post"
          action="?/issuePairingCode"
          use:enhance={() => {
            isIssuingPairingCode = true;
            return async ({ update }) => {
              await update();
              isIssuingPairingCode = false;
            };
          }}
        >
          <Button type="submit" disabled={isIssuingPairingCode}>
            <Radio size={16} />
            {isIssuingPairingCode ? 'Generating...' : 'Generate pairing code'}
          </Button>
        </form>

        <div class="border-t pt-4">
          <h3 class="font-semibold">Paired RFID tags</h3>
          {#if data.tags.length > 0}
            <ul class="mt-3 flex flex-col divide-y rounded-lg border">
              {#each data.tags as tag (tag.id)}
                <li class="flex items-center justify-between gap-3 px-3 py-3">
                  <div class="min-w-0">
                    <code class="block truncate font-mono text-sm"
                      >{tag.rfidUid}</code
                    >
                    <span class="text-xs text-muted-foreground">
                      Paired {formatDate(tag.createdAt)}
                    </span>
                  </div>
                  <form
                    method="post"
                    action="?/unlinkTag"
                    class="shrink-0"
                    use:enhance
                  >
                    <input type="hidden" name="tagId" value={tag.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      class="gap-2"
                      onclick={handleUnlinkClick}
                    >
                      <Unlink size={16} />
                      Unlink
                    </Button>
                  </form>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="mt-2 text-sm text-muted-foreground">
              You don't have any paired RFID tags yet.
            </p>
          {/if}
        </div>
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle>Personal Access Tokens</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted-foreground">
          Personal access tokens allow you to authenticate with the API
          programmatically. Keep your tokens secure and never share them.
        </p>

        {#if form?.createdToken != null}
          <div
            class="flex flex-col gap-3 rounded-lg border border-l-4 border-primary bg-green-950/20 p-4"
          >
            <div class="flex items-start gap-2">
              <AlertCircle class="mt-0.5 shrink-0 text-primary" size={20} />
              <div class="flex-1">
                <p class="font-semibold text-primary">Save your token now!</p>
                <p class="text-sm text-muted-foreground">
                  You won't be able to see this token again. Copy it now and
                  store it securely.
                </p>
              </div>
            </div>
            <div class="flex gap-2">
              <code
                class="flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm"
              >
                {form.createdToken.token}
              </code>
              <Button
                variant="outline"
                size="sm"
                onclick={() => copyToClipboard(form.createdToken.token)}
              >
                {#if copySuccess}
                  <Check size={16} />
                {:else}
                  <Copy size={16} />
                {/if}
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
            class="flex flex-col gap-4 rounded-lg border border-muted p-4"
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
                class="rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                class="rounded-md border border-input bg-background px-3 py-2 text-sm"
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
          <div class="mt-4 overflow-hidden rounded-lg border border-muted">
            <table class="w-full">
              <thead class="border-b border-muted bg-muted/50">
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
                {#each data.tokens as token (token.id)}
                  <tr class="border-b border-muted last:border-0">
                    <td class="px-4 py-3 font-medium">{token.name}</td>
                    <td class="px-4 py-3 text-sm text-muted-foreground"
                      >{formatDate(token.lastUsedAt, 'Never')}</td
                    >
                    <td class="px-4 py-3 text-sm text-muted-foreground"
                      >{formatDate(token.expiresAt, 'Never')}</td
                    >
                    <td class="px-4 py-3 text-sm text-muted-foreground"
                      >{formatDate(token.createdAt, 'Never')}</td
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
                          class="gap-2"
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
          <p class="text-sm text-muted-foreground">
            You don't have any personal access tokens yet. Create one to get
            started.
          </p>
        {/if}
      </div>
    </CardContent>
  </Card>
</div>
