<script lang="ts">
  import { createRefreshQueueStatus } from '$lib/components/matchmaking/queue-status-updater';
  import { Play } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import NavbarNav from './navbar-nav.svelte';

  interface Props {
    path: string;
  }

  let { path }: Props = $props();

  let badge: number | undefined = $state(undefined);
  const refreshQueueStatus = createRefreshQueueStatus((status) => {
    if (status.playersInQueue > 0) {
      badge = status.playersInQueue;
    } else {
      badge = undefined;
    }
  });

  onMount(() => {
    refreshQueueStatus();
    const interval = setInterval(refreshQueueStatus, 10000);
    return () => clearInterval(interval);
  });
</script>

<NavbarNav {path} {badge}><Play /></NavbarNav>
