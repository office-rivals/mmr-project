import { Outlet, createFileRoute, useMatches } from '@tanstack/react-router';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { Header } from '@/components/shell/header';
import { refreshAuthedShellData } from '@/lib/shell';
import { cn } from '@/lib/utils';

// Profile failures remain data so profile-independent pages can still render.
export const Route = createFileRoute('/_authed')({
  head: () => ({
    styles: [
      {
        // Keep anchor targets below the fixed phone header; the desktop
        // sidebar does not cover the top of the page.
        children:
          'html{scroll-padding-top:calc(env(safe-area-inset-top) + var(--header-height) + 1rem)}@media (min-width:64rem){html{scroll-padding-top:1rem}}body{min-height:100vh}',
      },
    ],
  }),
  beforeLoad: async ({ context }) => ({
    authedShell: await refreshAuthedShellData(context.queryClient),
  }),
  component: AuthedLayout,
});

function AuthedLayout() {
  const { authedShell: shell } = Route.useRouteContext();
  const wide = useMatches({
    select: (matches) => matches.some((m) => m.staticData.wide),
  });

  return (
    <>
      <PullToRefresh />
      <Header
        organizations={shell.organizations}
        displayName={shell.displayName}
        username={shell.username}
        openFlagCount={shell.openFlagCount}
        defaultOrgSlug={shell.defaultOrgSlug}
        defaultLeagueSlug={shell.defaultLeagueSlug}
        defaultOrgId={shell.defaultOrgId}
        defaultLeagueId={shell.defaultLeagueId}
        defaultLeaguePlayerId={shell.defaultLeaguePlayerId}
      />
      <main className="overflow-auto lg:pl-60">
        <div
          className={cn(
            'mx-auto w-full max-w-screen-sm px-4 pt-[calc(env(safe-area-inset-top)+var(--header-height)+1rem)] pb-[calc(env(safe-area-inset-bottom)+11rem)] lg:pt-8 lg:pb-12',
            wide ? 'lg:max-w-[72rem] lg:px-10' : 'lg:max-w-screen-md lg:px-8'
          )}
        >
          <Outlet />
        </div>
      </main>
    </>
  );
}
