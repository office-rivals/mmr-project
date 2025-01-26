<script lang="ts">
  import { cn } from '$lib/utils.js';
  import {
    Dialog as DialogPrimitive,
    type WithoutChildrenOrChild,
  } from 'bits-ui';
  import type { Snippet } from 'svelte';

  interface Props
    extends WithoutChildrenOrChild<DialogPrimitive.DescriptionProps> {
    children?: Snippet;
    [key: string]: any;
  }

  let { class: className = undefined, children, ...rest }: Props = $props();
</script>

<DialogPrimitive.Description
  class={cn('text-muted-foreground text-sm', className)}
  {...rest}
>
  {@render children?.()}
</DialogPrimitive.Description>
