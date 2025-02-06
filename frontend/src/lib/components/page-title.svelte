<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

<h1 class="text-center text-4xl font-extrabold md:text-6xl">
  {@render children?.()}
</h1>
