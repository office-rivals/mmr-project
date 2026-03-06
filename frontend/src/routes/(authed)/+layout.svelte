<script lang="ts">
  import '@carbon/charts-svelte/styles.css';
  import '../../app.pcss';

  import QueueIndicator from '$lib/components/matchmaking/queue-indicator.svelte';
  import PullToRefresh from '$lib/components/pull-to-refresh.svelte';
  import type { Snippet } from 'svelte';
  import Navbar from './components/navbar.svelte';
  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

<PullToRefresh />
<main class="mx-auto max-w-screen-sm overflow-auto p-4" style="margin-bottom: calc(4rem + env(safe-area-inset-bottom))">
  {@render children?.()}
</main>
<QueueIndicator />
<Navbar />

<style lang="postcss">
  :global(body) {
    @apply min-h-screen;
  }
</style>
