<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';
  interface Props extends DialogPrimitive.PortalProps {
    children?: Snippet;
  }

  let { children, ...rest }: Props = $props();
</script>

<DialogPrimitive.Portal {...rest}>
  {@render children?.()}
</DialogPrimitive.Portal>
