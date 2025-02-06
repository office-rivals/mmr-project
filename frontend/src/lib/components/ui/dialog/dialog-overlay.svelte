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
  class={cn('bg-background/80 fixed inset-0 z-50 backdrop-blur-sm', className)}
  {...rest}
>
  {#snippet child({ props, open })}
    {#if open}
      <div {...props} transition:fade={{ duration: 150 }}></div>
    {/if}
  {/snippet}
</DialogPrimitive.Overlay>
