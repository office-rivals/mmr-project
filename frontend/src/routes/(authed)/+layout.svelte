<script lang="ts">
  import '@carbon/charts-svelte/styles.css';
  import '../../app.pcss';

  import QueueIndicator from '$lib/components/matchmaking/queue-indicator.svelte';
  import type { Snippet } from 'svelte';
  import Navbar from './components/navbar.svelte';
  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

<main class="mx-auto mb-16 max-w-screen-sm overflow-auto p-4">
  {@render children?.()}
</main>
<QueueIndicator />
<Navbar />

<style lang="postcss">
  :global(body) {
    @apply min-h-screen;
  }
</style>
