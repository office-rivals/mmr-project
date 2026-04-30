<script lang="ts">
  import { Play } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import NavbarNav from './navbar-nav.svelte';

  interface Props {
    path: string;
    orgId: string;
    leagueId: string;
  }

  let { path, orgId, leagueId }: Props = $props();

  let badge: number | undefined = $state(undefined);

  const refresh = async () => {
    try {
      const res = await fetch(
        `/api/v3/organizations/${orgId}/leagues/${leagueId}/queue`
      );
      if (!res.ok) return;
      const data = await res.json();
      const count = (data.queuedPlayers ?? []).length;
      badge = count > 0 ? count : undefined;
    } catch {
      // ignore
    }
  };

  onMount(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  });
</script>

<NavbarNav {path} {badge}><Play /></NavbarNav>
