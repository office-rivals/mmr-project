<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLDivElement> {
    label: string;
  }

  let { label, ...rest }: Props = $props();
</script>

<div
  class="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
  {...rest}
>
  {label}
</div>
