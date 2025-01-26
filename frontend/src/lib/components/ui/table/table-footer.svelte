<script lang="ts">
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLTableSectionElement> {
    children?: Snippet;
  }

  let { class: className = undefined, children, ...rest }: Props = $props();
</script>

<tfoot
  class={cn('bg-primary text-primary-foreground font-medium', className)}
  {...rest}
>
  {@render children?.()}
</tfoot>
