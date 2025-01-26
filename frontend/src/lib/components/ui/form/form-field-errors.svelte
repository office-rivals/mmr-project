<script lang="ts">
  import { cn } from '$lib/utils.js';
  import * as FormPrimitive from 'formsnap';
  import type { Snippet } from 'svelte';

  type $$Props = FormPrimitive.FieldErrorsProps & {
    errorClasses?: string | undefined | null;
  };

  type Props = $$Props & {
    errorClasses?: $$Props['class'];
    children?: Snippet;
  };

  let {
    class: className = undefined,
    errorClasses = undefined,
    children,
    ...rest
  }: Props = $props();

  const children_render = $derived(children);
</script>

<FormPrimitive.FieldErrors
  class={cn('text-destructive text-sm font-medium', className)}
  {...rest}
>
  {#snippet children({ errors, errorProps, ...rest })}
    {#if children_render}{@render children_render({
        errors,
        errorProps,
        ...rest,
      })}{:else}
      {#each errors as error}
        <div {...errorProps} class={cn(errorClasses)}>{error}</div>
      {/each}
    {/if}
  {/snippet}
</FormPrimitive.FieldErrors>
