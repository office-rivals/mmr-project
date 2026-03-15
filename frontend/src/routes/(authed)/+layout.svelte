<script lang="ts">
  import '../../app.pcss';

  import type { Snippet } from 'svelte';
  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

<main class="mx-auto max-w-screen-sm overflow-auto p-4">
  {@render children?.()}
</main>

<style lang="postcss">
  :global(body) {
    @apply min-h-screen;
  }
</style>
