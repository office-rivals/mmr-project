<script lang="ts">
  import { cn } from '$lib/utils.js';
  import * as FormPrimitive from 'formsnap';
  import type { Snippet } from 'svelte';

  interface Props extends FormPrimitive.DescriptionProps {
    children?: Snippet;
  }

  let { class: className = undefined, ...rest }: Props = $props();
</script>

<FormPrimitive.Description
  class={cn('text-muted-foreground text-sm', className)}
  {...rest}
/>
