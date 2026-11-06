<script lang="ts">
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';
  import type { HTMLTableAttributes } from 'svelte/elements';

  interface Props extends HTMLTableAttributes {
    children?: Snippet;
  }

  let { class: className = undefined, children, ...rest }: Props = $props();
</script>

<div class="relative w-full overflow-auto">
  <table class={cn('w-full caption-bottom text-sm', className)} {...rest}>
    {@render children?.()}
  </table>
</div>
