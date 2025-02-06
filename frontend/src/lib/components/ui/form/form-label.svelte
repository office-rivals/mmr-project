<script lang="ts">
  import { Label } from '$lib/components/ui/label/index.js';
  import { cn } from '$lib/utils.js';
  import { useFormControl, type LabelProps } from 'formsnap';

  let { class: className = undefined, child, ...rest }: LabelProps = $props();

  const control = useFormControl({});
</script>

<Label
  {...control.labelProps}
  class={cn('data-[fs-error]:text-destructive', className)}
  {...rest}
>
  {@render child?.({ props: control.labelProps })}
</Label>
