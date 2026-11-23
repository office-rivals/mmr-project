<script lang="ts" module>
  import type { FormPathLeaves, SuperForm } from 'sveltekit-superforms';
  type T = Record<string, unknown>;
  type U = FormPathLeaves<T>;
</script>

<script
  lang="ts"
  generics="T extends Record<string, unknown>, U extends FormPathLeaves<T>"
>
  import { cn } from '$lib/utils.js';
  import * as FormPrimitive from 'formsnap';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type $$Props = FormPrimitive.ElementFieldProps<T, U> &
    HTMLAttributes<HTMLElement>;

  type Props = $$Props & {
    form: SuperForm<T>;
    name: U;
    children?: Snippet;
  };

  let { form, name, class: className = undefined, children }: Props = $props();

  const children_render = $derived(children);
</script>

<FormPrimitive.ElementField {form} {name}>
  {#snippet children(values)}
    <div class={cn('space-y-2', className)}>
      {@render children_render?.(values)}
    </div>
  {/snippet}
</FormPrimitive.ElementField>
