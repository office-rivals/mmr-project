<script lang="ts">
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';
  import type { HTMLTdAttributes } from 'svelte/elements';

  interface Props extends HTMLTdAttributes {
    children?: Snippet;
  }

  let { class: className = undefined, children, ...rest }: Props = $props();
</script>

<td
  class={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
  {...rest}
>
  {@render children?.()}
</td>
