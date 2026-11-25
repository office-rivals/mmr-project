<script lang="ts" module>
  import type { FormPath, SuperForm } from 'sveltekit-superforms';
  type T = Record<string, unknown>;
  type U = FormPath<T>;
</script>

<script
  lang="ts"
  generics="T extends Record<string, unknown>, U extends FormPath<T>"
>
  import { cn } from '$lib/utils.js';
  import * as FormPrimitive from 'formsnap';
  import type { Snippet } from 'svelte';

  interface Props extends FormPrimitive.FieldsetProps<T, U> {
    form: SuperForm<T>;
    name: U;
    children?: Snippet;
  }

  let { form, name, class: className = undefined, ...rest }: Props = $props();
</script>

<FormPrimitive.Fieldset
  {form}
  {name}
  class={cn('space-y-2', className)}
  {...rest}
/>
