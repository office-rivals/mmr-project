<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';

  let {
    class: className = undefined,
    ...rest
  }: DropdownMenuPrimitive.GroupHeadingProps = $props();
</script>

<DropdownMenuPrimitive.GroupHeading
  class={cn(
    'flex items-center gap-2 px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
    className
  )}
  {...rest}
/>
