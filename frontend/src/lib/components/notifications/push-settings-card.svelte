<script lang="ts">
  import { onMount } from 'svelte';
  import { Bell, BellOff, Check, LoaderCircle, Smartphone, X } from 'lucide-svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Card from '$lib/components/ui/card/card.svelte';
  import CardContent from '$lib/components/ui/card/card-content.svelte';
  import CardHeader from '$lib/components/ui/card/card-header.svelte';
  import CardTitle from '$lib/components/ui/card/card-title.svelte';
  import {
    type PushPermissionSnapshot,
    checkSubscribed,
    getPermissionSnapshot,
    subscribe,
    unsubscribe,
  } from '$lib/push/subscribe';

  let snapshot = $state<PushPermissionSnapshot>({ state: 'unsupported', permission: 'unsupported' });
  let busy = $state(false);
  let error = $state<string | null>(null);
  let lastSuccess = $state<string | null>(null);

  async function refresh() {
    const next = getPermissionSnapshot();
    snapshot = next;
    if (next.state === 'subscribed') {
      const actuallySubscribed = await checkSubscribed();
      if (!actuallySubscribed) {
        snapshot = { state: 'unsubscribed', permission: next.permission };
      }
    }
  }

  onMount(() => {
    refresh();
  });

  async function handleEnable() {
    error = null;
    lastSuccess = null;
    busy = true;
    try {
      await subscribe();
      lastSuccess = 'Push notifications enabled.';
      await refresh();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to enable push notifications';
      await refresh();
    } finally {
      busy = false;
    }
  }

  async function handleDisable() {
    error = null;
    lastSuccess = null;
    busy = true;
    try {
      await unsubscribe();
      lastSuccess = 'Push notifications disabled.';
      await refresh();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to disable push notifications';
    } finally {
      busy = false;
    }
  }

  const stateLabel: Record<PushPermissionSnapshot['state'], string> = {
    unsupported: 'Not supported in this browser',
    denied: 'Blocked — change site permissions in your browser settings',
    default: 'Not enabled',
    subscribed: 'Enabled',
    unsubscribed: 'Permission granted but not subscribed',
  };
</script>

<Card>
  <CardHeader>
    <CardTitle>Push Notifications</CardTitle>
  </CardHeader>
  <CardContent>
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted-foreground">
        Get notified on this device when a match is found or after a match is reported. Notifications
        are delivered through your browser's push service and require adding this site to your home
        screen on iOS.
      </p>

      <div class="flex items-center gap-3 rounded-lg border border-muted p-3">
        {#if snapshot.state === 'subscribed'}
          <Bell class="shrink-0 text-primary" size={20} />
        {:else if snapshot.state === 'denied' || snapshot.state === 'unsupported'}
          <BellOff class="shrink-0 text-muted-foreground" size={20} />
        {:else}
          <Smartphone class="shrink-0 text-muted-foreground" size={20} />
        {/if}
        <span class="flex-1 text-sm">{stateLabel[snapshot.state]}</span>
        {#if busy}
          <LoaderCircle class="animate-spin" size={16} />
        {/if}
      </div>

      {#if error}
        <div
          class="flex items-start gap-2 rounded-lg border border-l-4 border-red-500 bg-red-950/20 p-3"
        >
          <X class="mt-0.5 shrink-0 text-red-500" size={16} />
          <p class="text-sm text-red-500">{error}</p>
        </div>
      {/if}

      {#if lastSuccess}
        <div
          class="flex items-start gap-2 rounded-lg border border-l-4 border-primary bg-green-950/20 p-3"
        >
          <Check class="mt-0.5 shrink-0 text-primary" size={16} />
          <p class="text-sm text-primary">{lastSuccess}</p>
        </div>
      {/if}

      <div class="flex flex-wrap gap-2">
        {#if snapshot.state === 'subscribed'}
          <Button variant="outline" disabled={busy} onclick={handleDisable}>
            <BellOff size={16} />
            Disable
          </Button>
        {:else if snapshot.state === 'unsupported'}
          <p class="text-xs text-muted-foreground">
            Your browser doesn't support Web Push. Try Chrome, Edge, Firefox, or Safari 16.4+.
          </p>
        {:else if snapshot.state === 'denied'}
          <p class="text-xs text-muted-foreground">
            You've blocked notifications for this site. Open your browser's site settings to allow
            them, then come back and refresh this page.
          </p>
        {:else}
          <Button disabled={busy} onclick={handleEnable}>
            <Bell size={16} />
            {busy ? 'Enabling…' : 'Enable notifications'}
          </Button>
        {/if}
      </div>
    </div>
  </CardContent>
</Card>