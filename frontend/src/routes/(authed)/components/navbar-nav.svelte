<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';
  import type { Snippet } from 'svelte';

  interface Props {
    path: string;
    isPrimary?: boolean;
    children?: Snippet;
  }

  let { path, isPrimary = false, children }: Props = $props();
  let isActive = $derived(path === page.url.pathname);
</script>

<Button
  variant={isPrimary ? 'default' : 'ghost'}
  href={path}
  class={cn('h-16 min-w-16 flex-1', {
    'text-primary hover:text-primary': !isPrimary && isActive,
  })}
>
  {@render children?.()}
</Button>
