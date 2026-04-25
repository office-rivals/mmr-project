<script lang="ts">
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLParagraphElement> {
    children?: Snippet;
  }

  let { class: className = undefined, children, ...rest }: Props = $props();
</script>

<p class={cn('text-sm text-muted-foreground', className)} {...rest}>
  {@render children?.()}
</p>
