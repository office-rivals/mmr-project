<script lang="ts">
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { HeadingLevel } from './index.js';

  type $$Props = HTMLAttributes<HTMLHeadingElement> & {
    tag?: HeadingLevel;
  };

  interface Props extends $$Props {
    children?: Snippet;
  }

  let {
    class: className = undefined,
    tag = 'h3',
    children,
    ...rest
  }: Props = $props();
</script>

<svelte:element
  this={tag}
  class={cn('text-lg font-semibold leading-none tracking-tight', className)}
  {...rest}
>
  {@render children?.()}
</svelte:element>
