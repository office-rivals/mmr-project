<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { DropdownMenu } from 'bits-ui';
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
  import { getPlayerDisplayName, getRoleBadgeVariant } from '$lib/utils';
  import {
    OrganizationRole,
    type MeLeagueResponse,
    type MeOrganizationResponse,
  } from '../../../api-v3/models';

  interface Props {
    organizations: MeOrganizationResponse[];
    displayName: string | null;
    username: string | null;
    defaultOrgSlug: string | null;
  }

  let { organizations, displayName, username, defaultOrgSlug }: Props =
    $props();

  const orgSlug = $derived(page.params.orgSlug ?? defaultOrgSlug);
  const currentOrg = $derived(organizations.find((o) => o.slug === orgSlug));
  // Only resolve a league when the user is actually on a league route; on
  // /settings, /random, etc. the trigger should show 'Select league'.
  const currentLeague = $derived(
    page.params.leagueSlug
      ? currentOrg?.leagues.find((l) => l.slug === page.params.leagueSlug)
      : undefined
  );
  const menuOrg = $derived(currentOrg ?? organizations[0]);

  const primaryName = $derived(
    getPlayerDisplayName({ displayName, username }, 'You')
  );
  // Show the @handle as a subtitle only when the primary line is the display
  // name (i.e. both fields exist); otherwise the handle is already primary.
  const secondaryName = $derived(
    displayName && username ? `@${username}` : null
  );

  const hasAdminAccess = $derived(
    menuOrg?.role === OrganizationRole.Owner ||
      menuOrg?.role === OrganizationRole.Moderator
  );
  // Admin link must target the same org as the role check. hasAdminAccess
  // already implies menuOrg exists, so this is non-null whenever the link shows.
  const adminOrgSlug = $derived(menuOrg?.slug ?? null);

  // Sub-routes whose path is identical across leagues (no league-scoped IDs),
  // so they can be carried over when switching. Anything else —
  // /active-match/[id], /player/[id] (handled specially below), or any future
  // id-bearing route — falls back to the league root rather than risk a stale,
  // league-scoped id 404ing in the destination league.
  const PORTABLE_SUBROUTES = ['matchmaking', 'statistics', 'submit'];

  const menuItemClass =
    'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted';

  function leagueRelativePath(targetLeague: MeLeagueResponse): string {
    if (!page.params.orgSlug || !page.params.leagueSlug) return '';
    const prefix = `/${page.params.orgSlug}/${page.params.leagueSlug}`;
    const path = page.url.pathname;
    if (!path.startsWith(prefix)) return '';
    const rest = path.slice(prefix.length);
    if (rest === '') return '';

    // /player/[id] — the id is league-scoped. If viewing self, jump to the
    // user's profile in the target league; otherwise fall back to the root.
    const playerMatch = rest.match(/^\/player\/([^/]+)/);
    if (playerMatch) {
      const [, viewingId] = playerMatch;
      if (
        viewingId === currentLeague?.leaguePlayerId &&
        targetLeague.leaguePlayerId
      ) {
        return `/player/${targetLeague.leaguePlayerId}`;
      }
      return '';
    }

    const [, firstSegment] = rest.split('/');
    return PORTABLE_SUBROUTES.includes(firstSegment) ? rest : '';
  }

  function navigateLeague(
    targetOrgSlug: string,
    targetLeague: MeLeagueResponse
  ) {
    // No-op when already on the target league's URL.
    if (
      page.params.orgSlug === targetOrgSlug &&
      page.params.leagueSlug === targetLeague.slug
    )
      return;
    const rest = leagueRelativePath(targetLeague);
    goto(`/${targetOrgSlug}/${targetLeague.slug}${rest}`, {
      invalidateAll: true,
    });
  }
</script>

<header
  class="fixed left-0 right-0 top-0 z-30 flex flex-row justify-center border-b bg-card"
  style="padding-top: env(safe-area-inset-top)"
>
  <div
    class="flex h-[var(--header-height)] w-full max-w-screen-sm items-center justify-between gap-3 px-4"
  >
    <div class="flex min-w-0 flex-1">
      {#if currentOrg}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
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
                {currentLeague?.name ?? 'Select league'}
              </span>
            </div>
            <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground" />
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              class="z-50 max-h-[70vh] w-[min(20rem,calc(100vw-2rem))] overflow-auto rounded-md border border-muted bg-popover p-1 text-popover-foreground shadow-lg focus:outline-none"
              sideOffset={6}
              align="start"
            >
              {#each organizations as org (org.id)}
                <DropdownMenu.Group>
                  <DropdownMenu.GroupHeading
                    class="flex items-center gap-2 px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    <Building2 class="h-3 w-3" />
                    <span class="truncate">{org.name}</span>
                  </DropdownMenu.GroupHeading>
                  {#each org.leagues as league (league.id)}
                    {@const isActive =
                      org.slug === page.params.orgSlug &&
                      league.slug === page.params.leagueSlug}
                    <DropdownMenu.Item
                      class="{menuItemClass} {isActive
                        ? 'bg-accent text-accent-foreground'
                        : ''}"
                      onSelect={() => navigateLeague(org.slug, league)}
                    >
                      <Trophy
                        class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      />
                      <span class="truncate">{league.name}</span>
                      {#if isActive}
                        <Check class="ml-auto h-4 w-4 text-ring" />
                      {/if}
                    </DropdownMenu.Item>
                  {/each}
                  {#if org.leagues.length === 0}
                    <div class="px-3 py-2 text-sm text-muted-foreground">
                      No leagues
                    </div>
                  {/if}
                </DropdownMenu.Group>
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      {/if}
    </div>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Settings menu"
      >
        <Settings class="h-5 w-5" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
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
                <Badge
                  variant={getRoleBadgeVariant(menuOrg.role)}
                  class="shrink-0 uppercase tracking-wider"
                >
                  {menuOrg.role}
                </Badge>
              </div>
            {/if}
          </div>

          <DropdownMenu.Group class="p-1">
            <DropdownMenu.Item
              class={menuItemClass}
              onSelect={() => goto('/settings')}
            >
              <KeyRound class="h-4 w-4 text-muted-foreground" />
              Personal Access Tokens
            </DropdownMenu.Item>
            {#if hasAdminAccess}
              <DropdownMenu.Item
                class={menuItemClass}
                onSelect={() => goto(`/admin/${adminOrgSlug}`)}
              >
                <Shield class="h-4 w-4 text-muted-foreground" />
                Admin
              </DropdownMenu.Item>
            {/if}
          </DropdownMenu.Group>

          <DropdownMenu.Separator class="my-1 h-px bg-muted" />

          <div class="p-1">
            <SignOutButton asChild>
              {#snippet children({ signOut }: { signOut: () => void })}
                <DropdownMenu.Item class={menuItemClass} onSelect={signOut}>
                  <LogOut class="h-4 w-4 text-muted-foreground" />
                  Sign out
                </DropdownMenu.Item>
              {/snippet}
            </SignOutButton>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  </div>
</header>
