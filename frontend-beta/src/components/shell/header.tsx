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
    <header
      className="fixed inset-x-0 top-0 z-30 border-b bg-card lg:inset-y-0 lg:right-auto lg:w-60 lg:border-r lg:border-b-0 lg:bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-[var(--header-height)] w-full max-w-screen-sm items-center gap-6 px-4 lg:h-full lg:max-w-none lg:flex-col lg:items-stretch lg:overflow-y-auto lg:py-6">
        <p className="hidden px-2 text-lg font-bold tracking-tight lg:block lg:pr-12">
          MMR Project
        </p>

        {/* From `lg` the settings trigger sits beside the brand, but it stays
            next to the switcher in the DOM so the two remain adjacent in the
            tab order. */}
        <div className="flex min-w-0 flex-1 items-center justify-between gap-1 lg:flex-none">
          <div className="flex min-w-0 flex-1">
            {currentOrg && (
              <LeagueSwitcher
                organizations={organizations}
                currentOrg={currentOrg}
              />
            )}
          </div>
          <div className="lg:absolute lg:right-3 lg:top-[calc(env(safe-area-inset-top)+1rem)]">
            <SettingsMenu
              organizations={organizations}
              menuOrg={menuOrg}
              displayName={displayName}
              username={username}
              openFlagCount={openFlagCount}
            />
          </div>
        </div>

        {links.base ? (
          <AppLink
            to={`${links.base}/submit`}
            className="hidden min-h-12 items-center justify-center gap-2 rounded-md bg-primary text-base font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none lg:flex"
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
