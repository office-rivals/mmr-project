<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { type VariantProps, tv } from 'tailwind-variants';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  const badgeVariants = tv({
    base: 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        user: 'border-transparent bg-blue-500/20 text-blue-400 border-blue-500/30',
        moderator: 'border-transparent bg-orange-500/20 text-orange-400 border-orange-500/30',
        owner: 'border-transparent bg-purple-500/20 text-purple-400 border-purple-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  });

  interface Props extends HTMLAttributes<HTMLSpanElement> {
    variant?: VariantProps<typeof badgeVariants>['variant'];
    children?: Snippet;
  }

  let { class: className = undefined, variant = 'default', children, ...rest }: Props = $props();
</script>

<span class={cn(badgeVariants({ variant }), className)} {...rest}>
  {@render children?.()}
</span>
