<script lang="ts">
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type $$Props = HTMLAttributes<HTMLTableRowElement> & {
    'data-state'?: unknown;
  };

  type Props = $$Props & {
    children?: Snippet;
  };

  let { class: className = undefined, children, ...rest }: Props = $props();
</script>

<tr
  class={cn(
    'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
    className
  )}
  {...rest}
>
  {@render children?.()}
</tr>
