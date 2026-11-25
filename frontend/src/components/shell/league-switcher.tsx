import { useLocation, useParams, useRouter } from '@tanstack/react-router';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Trophy,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, initials } from '@/lib/utils';
import type { MeLeagueResponse, MeOrganizationResponse } from '@/api-v3';

interface LeagueSwitcherProps {
  organizations: MeOrganizationResponse[];
  currentOrg: MeOrganizationResponse;
}

// Sub-routes whose path is identical across leagues (no league-scoped ids), so
// they survive a league switch. Anything else — /active-match/[id],
// /player/[id] (handled specially) or any future id-bearing route — falls back
// to the league root rather than 404 on a stale, league-scoped id.
const PORTABLE_SUBROUTES = [
  'matchmaking',
  'statistics',
  'submit',
  'leaderboard',
  'matches',
];

export function LeagueSwitcher({
  organizations,
  currentOrg,
}: LeagueSwitcherProps) {
  const params = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const router = useRouter();

  // Only resolve a league when the user is actually on a league route; on
  // /settings, /random, / and /[orgSlug] the trigger must read 'Select league'.
  const currentLeague = params.leagueSlug
    ? currentOrg.leagues.find((l) => l.slug === params.leagueSlug)
    : undefined;

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
    void router.navigate({
      href: `/${targetOrgSlug}/${targetLeague.slug}${rest}`,
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex min-h-11 max-w-full min-w-0 items-center gap-2.5 rounded-md py-1 pr-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          'lg:min-h-[52px] lg:w-full lg:border lg:p-2'
        )}
        aria-label="Switch organization or league"
      >
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold text-primary lg:size-8 lg:text-xs"
        >
          {initials(currentOrg.name)}
        </span>
        {/* Phones keep the bar to one line: the chip stands in for the org. */}
        <span className="flex min-w-0 flex-col leading-tight lg:flex-1">
          <span className="hidden truncate text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase lg:block">
            {currentOrg.name}
          </span>
          <span className="truncate text-[15px] font-semibold">
            {currentLeague?.name ?? 'Select league'}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground lg:hidden"
        />
        <ChevronsUpDown
          aria-hidden="true"
          className="hidden size-4 shrink-0 text-muted-foreground lg:block"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="max-h-[70vh] w-[min(20rem,calc(100vw-2rem))] overflow-auto"
        align="start"
      >
        {organizations.map((org) => (
          <DropdownMenuGroup key={org.id}>
            <DropdownMenuLabel className="flex items-center gap-2 px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
                  {isActive && <Check className="ml-auto h-4 w-4 text-ring" />}
                </DropdownMenuItem>
              );
            })}
            {org.leagues.length === 0 && (
              <DropdownMenuItem disabled className="text-muted-foreground">
                No leagues
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
