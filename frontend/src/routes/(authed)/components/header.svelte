<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Popover } from 'bits-ui';
  import {
    Building2,
    Check,
    ChevronDown,
    KeyRound,
    LogOut,
    Settings,
    Shield,
    Trophy,
  } from 'lucide-svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { SignOutButton } from 'svelte-clerk';
  import { getPlayerDisplayName } from '$lib/utils';
  import {
    OrganizationRole,
    type MeLeagueResponse,
    type MeOrganizationResponse,
  } from '../../../api-v3/models';

  interface Props {
    organizations: MeOrganizationResponse[];
    displayName: string | null;
    username: string | null;
    email: string | null;
    defaultOrgSlug: string | null;
    defaultLeagueSlug: string | null;
  }

  let {
    organizations,
    displayName,
    username,
    email,
    defaultOrgSlug,
    defaultLeagueSlug,
  }: Props = $props();

  let switcherOpen = $state(false);
  let userMenuOpen = $state(false);

  const orgSlug = $derived(page.params.orgSlug ?? defaultOrgSlug);
  const leagueSlug = $derived(page.params.leagueSlug ?? defaultLeagueSlug);

  const currentOrg = $derived(organizations.find((o) => o.slug === orgSlug));
  const currentLeague = $derived(
    currentOrg?.leagues.find((l) => l.slug === leagueSlug)
  );
  const menuOrg = $derived(currentOrg ?? organizations[0]);

  const primaryName = $derived(
    getPlayerDisplayName({ displayName, username }, email ?? 'You')
  );
  const secondaryName = $derived(
    displayName && username
      ? `@${username}`
      : displayName || username
        ? email
        : null
  );

  const hasAdminAccess = $derived(
    menuOrg?.role === OrganizationRole.Owner ||
      menuOrg?.role === OrganizationRole.Moderator
  );
  const adminOrgSlug = $derived(orgSlug ?? menuOrg?.slug ?? null);

  function leagueRelativePath(targetLeague: MeLeagueResponse): string {
    if (!orgSlug || !leagueSlug) return '';
    const prefix = `/${orgSlug}/${leagueSlug}`;
    const path = page.url.pathname;
    if (!path.startsWith(prefix)) return '';
    const rest = path.slice(prefix.length);

    // /player/[id] — the id is league-scoped. If viewing self, jump to the
    // user's profile in the target league; otherwise fall back to the root.
    const playerMatch = rest.match(/^\/player\/([^/]+)(.*)$/);
    if (playerMatch) {
      const [, viewingId, tail] = playerMatch;
      if (
        viewingId === currentLeague?.leaguePlayerId &&
        targetLeague.leaguePlayerId
      ) {
        return `/player/${targetLeague.leaguePlayerId}${tail}`;
      }
      return '';
    }

    // /active-match/[id] — match id is league-scoped, not portable.
    if (rest.startsWith('/active-match/')) return '';

    return rest;
  }

  function navigateLeague(
    targetOrgSlug: string,
    targetLeague: MeLeagueResponse
  ) {
    switcherOpen = false;
    if (targetOrgSlug === orgSlug && targetLeague.slug === leagueSlug) return;
    const rest = leagueRelativePath(targetLeague);
    goto(`/${targetOrgSlug}/${targetLeague.slug}${rest}`, {
      invalidateAll: true,
    });
  }

  function navigateTo(href: string) {
    userMenuOpen = false;
    goto(href);
  }
</script>

<header
  class="fixed left-0 right-0 top-0 z-30 flex w-screen flex-row justify-center border-b bg-card"
  style="padding-top: env(safe-area-inset-top)"
>
  <div
    class="flex h-16 w-full max-w-screen-sm items-center justify-between gap-3 px-4"
  >
    <div class="flex min-w-0 flex-1">
      {#if currentOrg && currentLeague}
        <Popover.Root bind:open={switcherOpen}>
          <Popover.Trigger
            class="-mx-2 -my-1 flex min-w-0 max-w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Switch organization or league"
          >
            <div class="flex min-w-0 flex-col">
              <span
                class="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {currentOrg.name}
              </span>
              <span class="truncate text-base font-semibold leading-tight">
                {currentLeague.name}
              </span>
            </div>
            <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground" />
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              class="z-50 max-h-[70vh] w-[min(20rem,calc(100vw-2rem))] overflow-auto rounded-md border border-muted bg-popover p-1 text-popover-foreground shadow-lg focus:outline-none"
              sideOffset={6}
              align="start"
            >
              {#each organizations as org (org.id)}
                <div class="px-2 pb-1 pt-2">
                  <div
                    class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    <Building2 class="h-3 w-3" />
                    <span class="truncate">{org.name}</span>
                  </div>
                </div>
                {#each org.leagues as league (league.id)}
                  {@const isActive =
                    org.slug === orgSlug && league.slug === leagueSlug}
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {isActive
                      ? 'bg-accent text-accent-foreground'
                      : ''}"
                    onclick={() => navigateLeague(org.slug, league)}
                  >
                    <Trophy
                      class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    />
                    <span class="truncate">{league.name}</span>
                    {#if isActive}
                      <Check class="ml-auto h-4 w-4 text-ring" />
                    {/if}
                  </button>
                {/each}
                {#if org.leagues.length === 0}
                  <div class="px-3 py-2 text-sm text-muted-foreground">
                    No leagues
                  </div>
                {/if}
              {/each}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      {/if}
    </div>

    <Popover.Root bind:open={userMenuOpen}>
      <Popover.Trigger
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Settings menu"
      >
        <Settings class="h-5 w-5" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          class="z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-muted bg-popover text-popover-foreground shadow-lg focus:outline-none"
          sideOffset={6}
          align="end"
        >
          <div class="border-b border-muted px-4 py-3">
            <div class="truncate text-sm font-semibold">{primaryName}</div>
            {#if secondaryName}
              <div class="truncate text-xs text-muted-foreground">
                {secondaryName}
              </div>
            {/if}
            {#if menuOrg}
              <div
                class="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground"
              >
                <span class="truncate">{menuOrg.name}</span>
                <Badge variant="secondary" class="shrink-0 uppercase tracking-wider">
                  {menuOrg.role}
                </Badge>
              </div>
            {/if}
          </div>

          <div class="p-1">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onclick={() => navigateTo('/settings')}
            >
              <KeyRound class="h-4 w-4 text-muted-foreground" />
              Personal Access Tokens
            </button>
            {#if hasAdminAccess && adminOrgSlug}
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onclick={() => navigateTo(`/admin/${adminOrgSlug}`)}
              >
                <Shield class="h-4 w-4 text-muted-foreground" />
                Admin
              </button>
            {/if}
          </div>

          <div class="border-t border-muted p-1">
            <SignOutButton asChild>
              {#snippet children({ signOut }: { signOut: () => void })}
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onclick={signOut}
                >
                  <LogOut class="h-4 w-4 text-muted-foreground" />
                  Sign out
                </button>
              {/snippet}
            </SignOutButton>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </div>
</header>
