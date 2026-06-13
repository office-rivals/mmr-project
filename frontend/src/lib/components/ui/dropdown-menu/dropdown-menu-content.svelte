<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';

  let {
    class: className = undefined,
    sideOffset = 6,
    ...rest
  }: DropdownMenuPrimitive.ContentProps = $props();
</script>

<DropdownMenuPrimitive.Portal>
  <DropdownMenuPrimitive.Content
    {sideOffset}
    class={cn(
      'z-50 rounded-md border border-muted bg-popover p-1 text-popover-foreground shadow-lg focus:outline-none',
      className
    )}
    {...rest}
  />
</DropdownMenuPrimitive.Portal>
