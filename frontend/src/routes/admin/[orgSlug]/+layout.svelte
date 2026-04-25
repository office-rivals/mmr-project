<script lang="ts">
  import { page } from '$app/stores';
  import { cn } from '$lib/utils';
  import { LayoutDashboard, Trophy, Users } from 'lucide-svelte';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  let {
    data,
    children,
  }: {
    data: LayoutData;
    children?: Snippet;
  } = $props();

  const base = $derived(`/admin/${data.orgSlug}`);
  const navItems = $derived([
    { href: base, label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: `${base}/members`, label: 'Members', icon: Users },
    { href: `${base}/leagues`, label: 'Leagues', icon: Trophy },
  ]);

  function isActive(href: string, exact: boolean) {
    const path = $page.url.pathname;
    return exact ? path === href : path === href || path.startsWith(`${href}/`);
  }
</script>

<div class="flex flex-col gap-6 lg:flex-row">
  <aside class="lg:w-56 lg:shrink-0">
    <nav class="flex flex-row gap-1 overflow-x-auto lg:flex-col">
      {#each navItems as item}
        {@const active = isActive(item.href, item.exact ?? false)}
        <a
          href={item.href}
          class={cn(
            'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors',
            active
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground/80 hover:bg-accent'
          )}
        >
          <item.icon class="h-4 w-4" />
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>
  </aside>

  <div class="min-w-0 flex-1">
    {@render children?.()}
  </div>
</div>
