<script lang="ts">
  import { page } from '$app/state';
  import StatusIndicator from '$lib/components/status-indicator.svelte';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';
  import type { Snippet } from 'svelte';

  interface Props {
    path: string;
    isPrimary?: boolean;
    children?: Snippet;
    badge?: number | boolean;
  }

  let { path, isPrimary = false, children, badge }: Props = $props();
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
  {#if badge}
    <div class="relative">
      <StatusIndicator variant="primary" class="absolute -right-3 -top-6"
        >{#if typeof badge === 'number'}{badge}{/if}</StatusIndicator
      >
    </div>
  {/if}
</Button>
