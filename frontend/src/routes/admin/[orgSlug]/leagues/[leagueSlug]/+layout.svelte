<script lang="ts">
  import { page } from '$app/stores';
  import { cn } from '$lib/utils';
  import {
    CalendarDays,
    ClipboardList,
    Flag,
    LayoutDashboard,
  } from 'lucide-svelte';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  let {
    data,
    children,
  }: {
    data: LayoutData;
    children?: Snippet;
  } = $props();

  const base = $derived(data.leagueAdminBase);
  const subnav = $derived([
    { href: base, label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: `${base}/matches`, label: 'Matches', icon: ClipboardList },
    { href: `${base}/match-flags`, label: 'Flags', icon: Flag },
    { href: `${base}/seasons`, label: 'Seasons', icon: CalendarDays },
  ]);

  function isActive(href: string, exact: boolean) {
    const path = $page.url.pathname;
    return exact ? path === href : path === href || path.startsWith(`${href}/`);
  }
</script>

<div class="space-y-4">
  <div>
    <p class="text-xs uppercase tracking-wide text-muted-foreground">League</p>
    <h2 class="text-xl font-semibold">{data.league.name}</h2>
  </div>

  <nav
    class="flex flex-row gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1"
  >
    {#each subnav as item}
      {@const active = isActive(item.href, item.exact ?? false)}
      <a
        href={item.href}
        class={cn(
          'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors',
          active
            ? 'bg-background shadow-sm'
            : 'text-muted-foreground hover:bg-background/60'
        )}
      >
        <item.icon class="h-4 w-4" />
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  {@render children?.()}
</div>
