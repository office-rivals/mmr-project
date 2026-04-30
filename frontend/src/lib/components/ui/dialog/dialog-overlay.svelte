<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { fade } from 'svelte/transition';

  let {
    class: className = undefined,
    child,
    ...rest
  }: DialogPrimitive.OverlayProps = $props();
</script>

<DialogPrimitive.Overlay
  class={cn('fixed inset-0 z-50 bg-background/80 backdrop-blur-sm', className)}
  {...rest}
>
  {#snippet child({ props, open })}
    {#if open}
      <div {...props} transition:fade={{ duration: 150 }}></div>
    {/if}
  {/snippet}
</DialogPrimitive.Overlay>
