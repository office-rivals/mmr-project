<script lang="ts">
  import type { UserDetails } from '$api';
  import { cn } from '$lib/utils';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLButtonElement> {
    user: UserDetails;
  }

  let { user, class: className = undefined, ...rest }: Props = $props();
</script>

<button
  {...rest}
  class={cn(
    'border-input hover:border-primary focus-visible:ring-ring ring-offset-background flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    className
  )}
  type="button"
>
  <p class="line-clamp-1 text-sm md:text-base">
    {user.displayName ?? user.name}
  </p>
  <p class="text-xs">
    {#if user.displayName != null}
      {user.name}
    {/if}
  </p>
</button>
