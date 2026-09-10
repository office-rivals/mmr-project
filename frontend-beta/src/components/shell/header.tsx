import { useClerk } from '@clerk/tanstack-react-start';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams, useRouter } from '@tanstack/react-router';
import {
  Building2,
  Check,
  ChevronDown,
  KeyRound,
  LogOut,
  Settings,
  Shield,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  cn,
  getPlayerDisplayName,
  getRoleBadgeVariant,
  isModeratorOrAbove,
} from '@/lib/utils';
import { meQueryKey } from '@/lib/shell';
import type { MeLeagueResponse, MeOrganizationResponse } from '@/api-v3';

interface HeaderProps {
  organizations: MeOrganizationResponse[];
  displayName: string | null;
  username: string | null;
  defaultOrgSlug: string | null;
  openFlagCount: number;
}

// Sub-routes whose path is identical across leagues (no league-scoped ids), so
// they survive a league switch. Anything else — /active-match/[id],
// /player/[id] (handled specially) or any future id-bearing route — falls back
// to the league root rather than 404 on a stale, league-scoped id.
const PORTABLE_SUBROUTES = ['matchmaking', 'statistics', 'submit'];

export function Header({
  organizations,
  displayName,
  username,
  defaultOrgSlug,
  openFlagCount,
}: HeaderProps) {
  const params = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();

  const orgSlug = params.orgSlug ?? defaultOrgSlug;
  const currentOrg = organizations.find((o) => o.slug === orgSlug);
  // Only resolve a league when the user is actually on a league route; on
  // /settings, /random, / and /[orgSlug] the trigger must read 'Select league'.
  const currentLeague = params.leagueSlug
    ? currentOrg?.leagues.find((l) => l.slug === params.leagueSlug)
    : undefined;
  const menuOrg = currentOrg ?? organizations[0];

  const primaryName = getPlayerDisplayName({ displayName, username }, 'You');
  // The @handle is a subtitle only when the primary line is the display name;
  // otherwise the handle is already the primary line.
  const secondaryName = displayName && username ? `@${username}` : null;

  // Visible if the user administers *any* org …
  const hasAdminAccess = organizations.some((o) => isModeratorOrAbove(o.role));
  // … but deep-linked only when they administer the currently-scoped one.
  const adminHref =
    menuOrg && isModeratorOrAbove(menuOrg.role)
      ? `/admin/${menuOrg.slug}`
      : '/admin';

  // Only alert when the user can actually act on it. The count and the
  // organizations list come from separate requests, so a profile failure can
  // leave a non-zero count with no Admin entry to reach — don't paint a red
  // dot the user has no way to resolve.
  const showFlagDot = hasAdminAccess && openFlagCount > 0;

  function leagueRelativePath(targetLeague: MeLeagueResponse): string {
    if (!params.orgSlug || !params.leagueSlug) return '';
    const prefix = `/${params.orgSlug}/${params.leagueSlug}`;
    if (!pathname.startsWith(prefix)) return '';
    const rest = pathname.slice(prefix.length);
    if (rest === '') return '';

    // /player/[id] — the id is league-scoped. Viewing self jumps to the user's
    // profile in the target league; anyone else falls back to the root.
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
      params.orgSlug === targetOrgSlug &&
      params.leagueSlug === targetLeague.slug
    ) {
      return;
    }
    const rest = leagueRelativePath(targetLeague);
    // The Svelte call was `goto(url, { invalidateAll: true })`. TanStack Router
    // re-runs every loader on navigation by default; dropping ['me'] as well
    // covers the switcher/navbar, which read it through the cache.
    void queryClient.invalidateQueries({ queryKey: meQueryKey });
    void router.navigate({
      href: `/${targetOrgSlug}/${targetLeague.slug}${rest}`,
    });
  }

  return (
    <header
      className="fixed left-0 right-0 top-0 z-30 flex flex-row justify-center border-b bg-card"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-[var(--header-height)] w-full max-w-screen-sm items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 flex-1">
          {currentOrg && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="-mx-2 -my-1 flex min-w-0 max-w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Switch organization or league"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {currentOrg.name}
                  </span>
                  <span className="truncate text-base font-semibold leading-tight">
                    {currentLeague?.name ?? 'Select league'}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="max-h-[70vh] w-[min(20rem,calc(100vw-2rem))] overflow-auto"
                align="start"
              >
                {organizations.map((org) => (
                  <DropdownMenuGroup key={org.id}>
                    <DropdownMenuLabel className="flex items-center gap-2 px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span className="truncate">{org.name}</span>
                    </DropdownMenuLabel>
                    {org.leagues.map((league) => {
                      const isActive =
                        org.slug === params.orgSlug &&
                        league.slug === params.leagueSlug;
                      return (
                        <DropdownMenuItem
                          key={league.id}
                          aria-current={isActive ? 'true' : undefined}
                          className={cn(
                            isActive &&
                              'bg-accent text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground'
                          )}
                          onSelect={() => navigateLeague(org.slug, league)}
                        >
                          <Trophy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{league.name}</span>
                          {isActive && (
                            <Check className="ml-auto h-4 w-4 text-ring" />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                    {org.leagues.length === 0 && (
                      <DropdownMenuItem
                        disabled
                        className="text-muted-foreground"
                      >
                        No leagues
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={
              showFlagDot
                ? 'Settings menu — unresolved match flags need attention'
                : 'Settings menu'
            }
          >
            <Settings className="h-5 w-5" />
            {showFlagDot && (
              <span
                className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card"
                aria-hidden="true"
              />
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[min(18rem,calc(100vw-2rem))] overflow-hidden p-0"
            align="end"
          >
            <div className="border-b border-muted px-4 py-3">
              <div className="truncate text-sm font-semibold">
                {primaryName}
              </div>
              {secondaryName && (
                <div className="truncate text-xs text-muted-foreground">
                  {secondaryName}
                </div>
              )}
              {menuOrg && (
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{menuOrg.name}</span>
                  <Badge
                    variant={getRoleBadgeVariant(menuOrg.role)}
                    className="shrink-0 uppercase tracking-wider"
                  >
                    {menuOrg.role}
                  </Badge>
                </div>
              )}
            </div>

            <div className="p-1">
              <DropdownMenuItem
                onSelect={() => void router.navigate({ href: '/settings' })}
              >
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                Personal Access Tokens
              </DropdownMenuItem>
              {hasAdminAccess && (
                <DropdownMenuItem
                  onSelect={() => void router.navigate({ href: adminHref })}
                >
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Admin
                  {openFlagCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="ml-auto"
                      aria-label={`${openFlagCount} unresolved match flags`}
                    >
                      {openFlagCount}
                    </Badge>
                  )}
                </DropdownMenuItem>
              )}
            </div>

            <DropdownMenuSeparator />

            <div className="p-1">
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut className="h-4 w-4 text-muted-foreground" />
                Sign out
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
