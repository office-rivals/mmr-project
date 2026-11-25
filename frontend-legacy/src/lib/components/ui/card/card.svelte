<script lang="ts">
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLDivElement> {
    children?: Snippet;
  }

  let { class: className = undefined, children, ...rest }: Props = $props();
</script>

<div
  class={cn(
    'rounded-lg border bg-card text-card-foreground shadow-sm',
    className
  )}
  {...rest}
>
  {@render children?.()}
</div>
