<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { type VariantProps, tv } from 'tailwind-variants';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  const alertVariants = tv({
    base: 'relative w-full rounded-lg border p-4',
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        success: 'border-green-500/50 text-green-400 bg-green-500/10',
        destructive: 'border-destructive/50 text-destructive bg-destructive/10',
        warning: 'border-orange-500/50 text-orange-400 bg-orange-500/10',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  });

  interface Props extends HTMLAttributes<HTMLDivElement> {
    variant?: VariantProps<typeof alertVariants>['variant'];
    children?: Snippet;
  }

  let { class: className = undefined, variant = 'default', children, ...rest }: Props = $props();
</script>

<div class={cn(alertVariants({ variant }), className)} role="alert" {...rest}>
  {@render children?.()}
</div>
