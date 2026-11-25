<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
    // Render the heading visually hidden but still in the document outline /
    // exposed to assistive tech — for pages whose visible title lives elsewhere.
    srOnly?: boolean;
  }

  let { children, srOnly = false }: Props = $props();
</script>

<h1
  class={srOnly ? 'sr-only' : 'text-center text-4xl font-extrabold md:text-6xl'}
>
  {@render children?.()}
</h1>
