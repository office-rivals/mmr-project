<script lang="ts">
  import { cn } from '$lib/utils';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type Variant = 'primary' | 'success' | 'warning' | 'error' | 'info';
  interface Props {
    variant: Variant;
    class?: HTMLAttributes<HTMLSpanElement>['class'];
    children?: Snippet;
  }

  let { variant, class: className = undefined, children }: Props = $props();
</script>

<span class={cn('inline-block', className)}>
  <span class="relative inline-flex">
    <span
      class={cn(
        'absolute inset-0 inline-flex animate-ping rounded-full opacity-75',
        {
          'bg-green-400': variant === 'success',
          'bg-yellow-400': variant === 'warning',
          'bg-red-400': variant === 'error',
          'bg-blue-400': variant === 'info',
          'bg-primary/90': variant === 'primary',
        }
      )}
    ></span>
    <span
      class={cn(
        'relative inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.65rem] text-white',
        {
          'bg-green-500': variant === 'success',
          'bg-yellow-500': variant === 'warning',
          'bg-red-500': variant === 'error',
          'bg-blue-500': variant === 'info',
          'bg-primary': variant === 'primary',
        }
      )}
    >
      {@render children?.()}
    </span>
  </span>
</span>
