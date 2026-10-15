import { useParams } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { getPlayerDisplayName, initials } from '@/lib/utils';
import { LeagueSwitcher } from './league-switcher';
import { LiveStatus } from './live-status';
import { Navbar } from './navbar';
import { SettingsMenu } from './settings-menu';
import { useShellLinks, type ShellDefaults } from './use-shell-links';
import type { MeOrganizationResponse } from '@/api-v3';

interface HeaderProps extends ShellDefaults {
  organizations: MeOrganizationResponse[];
  displayName: string | null;
  username: string | null;
  openFlagCount: number;
}

/**
 * The app chrome: a top bar with the bottom navigation on phones, and a left
 * sidebar from `lg` up. It is one element at every width, so each control
 * (switcher, settings, navigation) exists exactly once and the switcher and
 * settings triggers stay adjacent in the tab order.
 *
 * On phones `<header>` itself is not positioned: the top bar, the bottom bar
 * and the live-status card are each fixed on their own, because a fixed element
 * nested inside another fixed one can trail the scroll on phones.
 */
export function Header({
  organizations,
  displayName,
  username,
  openFlagCount,
  ...defaults
}: HeaderProps) {
  const params = useParams({ strict: false });
  const links = useShellLinks(defaults);

  const orgSlug = params.orgSlug ?? defaults.defaultOrgSlug;
  const currentOrg = organizations.find((o) => o.slug === orgSlug);
  const menuOrg = currentOrg ?? organizations[0];
  const name = getPlayerDisplayName({ displayName, username }, 'You');
  const teamSize =
    organizations
      .flatMap((o) => o.leagues ?? [])
      .find((l) => l.id === links.leagueId)?.teamSize ?? null;

  return (
    <header className="lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-60 lg:border-r lg:bg-background lg:pt-[env(safe-area-inset-top)]">
      <div className="lg:flex lg:h-full lg:flex-col lg:gap-6 lg:overflow-y-auto lg:px-4 lg:py-6">
        <p className="hidden px-2 text-lg font-bold tracking-tight lg:block lg:pr-12">
          MMR Project
        </p>

        {/* From `lg` the settings trigger sits beside the brand, but it stays
            next to the switcher in the DOM so the two remain adjacent in the
            tab order. */}
        <div className="fixed inset-x-0 top-0 z-30 border-b bg-card pt-[env(safe-area-inset-top)] lg:static lg:z-auto lg:border-b-0 lg:bg-transparent lg:pt-0">
          <div className="mx-auto flex h-[var(--header-height)] w-full max-w-screen-sm min-w-0 items-center justify-between gap-1 px-4 lg:h-auto lg:max-w-none lg:px-0">
            <div className="flex min-w-0 flex-1">
              {currentOrg && (
                <LeagueSwitcher
                  organizations={organizations}
                  currentOrg={currentOrg}
                />
              )}
            </div>
            <div className="lg:absolute lg:top-[calc(env(safe-area-inset-top)+1rem)] lg:right-3">
              <SettingsMenu
                organizations={organizations}
                menuOrg={menuOrg}
                displayName={displayName}
                username={username}
                openFlagCount={openFlagCount}
              />
            </div>
          </div>
        </div>

        {links.base ? (
          <AppLink
            to={`${links.base}/submit`}
            className="hidden min-h-12 items-center justify-center gap-2 rounded-md bg-primary-fill text-base font-bold text-primary-foreground transition-colors hover:bg-primary-fill/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none lg:flex"
          >
            <Plus aria-hidden="true" className="size-5" />
            Submit match
          </AppLink>
        ) : null}

        {links.base ? (
          <Navbar
            base={links.base}
            orgId={links.orgId}
            leagueId={links.leagueId}
            profilePath={links.profilePath}
          />
        ) : null}

        <div className="contents lg:mt-auto lg:flex lg:flex-col lg:gap-4">
          {links.base && links.orgId && links.leagueId ? (
            <LiveStatus
              base={links.base}
              orgId={links.orgId}
              leagueId={links.leagueId}
              leaguePlayerId={links.leaguePlayerId}
              teamSize={teamSize}
            />
          ) : null}
          <AppLink
            to={links.profilePath}
            activeOptions={{ exact: true, includeSearch: false }}
            className="hidden items-center gap-3 rounded-md p-2 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[status=active]:bg-muted lg:flex"
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary text-xs font-bold text-primary"
            >
              {initials(name)}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">{name}</span>
              {displayName && username ? (
                <span className="truncate text-xs text-muted-foreground">
                  @{username}
                </span>
              ) : null}
              <span className="sr-only">Your profile</span>
            </span>
          </AppLink>
        </div>
      </div>
    </header>
  );
}
