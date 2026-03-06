<script lang="ts">
  import { page } from '$app/stores';
  import { Badge } from '$lib/components/ui/badge';
  import {
    ArrowLeft,
    ClipboardList,
    LayoutDashboard,
    Menu,
    Users,
    X,
  } from 'lucide-svelte';
  import '../../app.pcss';
  import type { LayoutData } from './$types';
  import { PlayerRole } from '../../api';

  let { data, children }: { data: LayoutData; children: any } = $props();
  const { userRole } = data;

  let sidebarOpen = $state(false);

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/matches', label: 'Match Management', icon: ClipboardList },
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
  <!-- Mobile header -->
  <div class="bg-card border-border fixed top-0 right-0 left-0 z-40 flex h-14 items-center border-b px-4 md:hidden">
    <button
      onclick={() => (sidebarOpen = !sidebarOpen)}
      class="text-foreground rounded-lg p-2 hover:bg-accent"
    >
      {#if sidebarOpen}
        <X class="h-5 w-5" />
      {:else}
        <Menu class="h-5 w-5" />
      {/if}
    </button>
    <h2 class="text-foreground ml-2 text-lg font-bold">Admin Panel</h2>
  </div>

  <!-- Backdrop for mobile -->
  {#if sidebarOpen}
    <button
      class="fixed inset-0 z-40 bg-black/50 md:hidden"
      onclick={() => (sidebarOpen = false)}
      aria-label="Close sidebar"
    ></button>
  {/if}

  <!-- Sidebar -->
  <aside
    class="border-border bg-card fixed top-14 z-50 flex h-[calc(100vh-3.5rem)] w-64 flex-col border-r transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0
      {sidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
  >
    <div class="border-border hidden h-16 items-center border-b px-6 md:flex">
      <h2 class="text-foreground text-xl font-bold">Admin Panel</h2>
    </div>

    <nav class="flex-1 space-y-1 overflow-y-auto p-4">
      {#each navItems as item}
        <a
          href={item.href}
          onclick={() => (sidebarOpen = false)}
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

  <main class="mt-14 flex-1 overflow-auto p-4 md:mt-0 md:p-8">
    <div class="mx-auto max-w-7xl">
      {@render children()}
    </div>
  </main>
</div>
