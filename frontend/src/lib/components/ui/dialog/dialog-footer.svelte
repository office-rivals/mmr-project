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
    'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
    className
  )}
  {...rest}
>
  {@render children?.()}
</div>
