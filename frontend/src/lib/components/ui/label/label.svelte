<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { Label as LabelPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';

  type Props = LabelPrimitive.RootProps & {
    children?: Snippet;
  };

  let { class: className = undefined, children, ...rest }: Props = $props();
</script>

<LabelPrimitive.Root
  class={cn(
    'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    className
  )}
  {...rest}
>
  {@render children?.()}
</LabelPrimitive.Root>
