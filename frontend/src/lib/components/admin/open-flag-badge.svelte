<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import { cn } from '$lib/utils';
  import { Flag } from 'lucide-svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props {
    count: number;
    /**
     * 'label' spells the count out ("3 open") for list rows; 'count' is the
     * bare pill used inside nav items, where the label supplies the context.
     */
    variant?: 'label' | 'count';
    class?: HTMLAttributes<HTMLSpanElement>['class'];
  }

  let {
    count,
    variant = 'label',
    class: className = undefined,
  }: Props = $props();
</script>

<!-- Renders nothing when there is nothing to flag, so call sites don't repeat
     the guard. -->
{#if count > 0}
  {#if variant === 'label'}
    <Badge variant="destructive" class={className}>
      <Flag class="mr-1 h-3 w-3" />
      {count} open
    </Badge>
  {:else}
    <span
      class={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground',
        className
      )}
      aria-label={`${count} open flags`}
    >
      {count}
    </span>
  {/if}
{/if}
