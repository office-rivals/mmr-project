<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLAttributes } from 'svelte/elements';

  interface PlayerLike {
    displayName?: string;
    username?: string;
  }

  interface Props extends HTMLAttributes<HTMLButtonElement> {
    user: PlayerLike;
  }

  let { user, class: className = undefined, ...rest }: Props = $props();
</script>

<button
  {...rest}
  class={cn(
    'flex w-full flex-col gap-1 rounded-md border border-input px-3 py-2 text-start ring-offset-background hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    className
  )}
  type="button"
>
  <p class="line-clamp-1 text-sm md:text-base">
    {user.displayName ?? user.username ?? 'Unknown'}
  </p>
  {#if user.displayName != null && user.username != null}
    <p class="text-xs">{user.username}</p>
  {/if}
</button>
