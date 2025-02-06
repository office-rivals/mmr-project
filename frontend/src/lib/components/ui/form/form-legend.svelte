<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { Legend, type LegendProps } from 'formsnap';

  let { class: className = undefined, ...rest }: LegendProps = $props();
</script>

<Legend
  class={cn(
    'data-[fs-error]:text-destructive text-sm font-medium leading-none',
    className
  )}
  {...rest}
/>
