<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props {
    title: string;
    class?: HTMLAttributes<HTMLDivElement>['class'];
    children?: import('svelte').Snippet;
  }

  let { title, class: className = undefined, children }: Props = $props();
</script>

<div
  class={cn(
    'flex flex-col justify-between gap-2 rounded bg-gray-800 p-4 shadow-sm',
    className
  )}
>
  <div class="text-base text-gray-300">{title}</div>
  <div class="text-primary text-2xl font-bold">
    {@render children?.()}
  </div>
</div>
