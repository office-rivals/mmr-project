<script lang="ts">
  import '@carbon/charts-svelte/styles.css';
  import '../../app.pcss';

  import QueueIndicator from '$lib/components/matchmaking/queue-indicator.svelte';
  import Navbar from './components/navbar.svelte';
</script>

<main class="mx-auto mb-16 max-w-screen-sm overflow-auto p-4">
  <slot></slot>
</main>
<QueueIndicator />
<Navbar />

<style lang="postcss">
  :global(body) {
    @apply min-h-screen;
  }
</style>
