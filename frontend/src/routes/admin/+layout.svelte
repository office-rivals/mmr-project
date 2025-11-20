<script lang="ts">
  import { page } from '$app/stores';
  import { Badge } from '$lib/components/ui/badge';
  import {
    ArrowLeft,
    ClipboardList,
    Flag,
    LayoutDashboard,
    Users,
  } from 'lucide-svelte';
  import '../../app.pcss';
  import type { LayoutData } from './$types';
  import { PlayerRole } from '../../api';

  let { data, children }: { data: LayoutData; children: any } = $props();
  const { userRole } = data;

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/matches', label: 'Match Management', icon: ClipboardList },
    { href: '/admin/match-flags', label: 'Flagged Matches', icon: Flag },
  ];

  if (userRole === PlayerRole.Owner || userRole === PlayerRole.Moderator) {
    navItems.push({
      href: '/admin/users',
      label: 'User Management',
      icon: Users,
    });
  }

  const isActive = (href: string) => {
    return $page.url.pathname === href;
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === PlayerRole.Owner) return 'owner';
    if (role === PlayerRole.Moderator) return 'moderator';
    return 'user';
  };
</script>

<div class="bg-background text-foreground dark flex min-h-screen">
  <aside
    class="border-border bg-card sticky top-0 flex h-screen w-64 flex-col border-r"
  >
    <div class="border-border flex h-16 items-center border-b px-6">
      <h2 class="text-foreground text-xl font-bold">Admin Panel</h2>
    </div>

    <nav class="flex-1 space-y-1 overflow-y-auto p-4">
      {#each navItems as item}
        <a
          href={item.href}
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(
            item.href
          )
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
        >
          <item.icon class="h-5 w-5" />
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>

    <div class="border-border space-y-4 border-t p-4">
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-sm">Role:</span>
        <Badge variant={getRoleBadgeVariant(userRole || PlayerRole.User)}
          >{userRole || PlayerRole.User}</Badge
        >
      </div>
      <a
        href="/"
        class="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
      >
        <ArrowLeft class="h-4 w-4" />
        <span>Back to App</span>
      </a>
    </div>
  </aside>

  <main class="flex-1 overflow-auto p-8">
    <div class="mx-auto max-w-7xl">
      {@render children()}
    </div>
  </main>
</div>
