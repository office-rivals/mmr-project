<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { Button as ButtonPrimitive } from 'bits-ui';
  import { buttonVariants, type Props as ButtonProps } from './index.js';

  let {
    class: className = undefined,
    variant = 'default',
    size = 'default',
    ...rest
  }: ButtonProps = $props();

  let buttonClass = $derived(cn(buttonVariants({ variant, size }), className));
</script>

<ButtonPrimitive.Root class={buttonClass} {...rest} />
