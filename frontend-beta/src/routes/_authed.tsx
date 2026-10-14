import { Outlet, createFileRoute } from '@tanstack/react-router';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { Header } from '@/components/shell/header';
import { Navbar } from '@/components/shell/navbar';
import { refreshAuthedShellData } from '@/lib/shell';

// Profile failures remain data so profile-independent pages can still render.
export const Route = createFileRoute('/_authed')({
  head: () => ({
    styles: [
      {
        // Keep anchor targets below the fixed header on authenticated pages.
        children:
          'html{scroll-padding-top:calc(env(safe-area-inset-top) + var(--header-height) + 1rem)}body{min-height:100vh}',
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

  return (
    <>
      <PullToRefresh />
      <Header
        organizations={shell.organizations}
        displayName={shell.displayName}
        username={shell.username}
        defaultOrgSlug={shell.defaultOrgSlug}
        openFlagCount={shell.openFlagCount}
      />
      <main
        className="mx-auto max-w-screen-sm overflow-auto p-4 pb-24"
        style={{
          paddingTop:
            'calc(env(safe-area-inset-top) + var(--header-height) + 1rem)',
        }}
      >
        <Outlet />
      </main>
      <Navbar
        defaultOrgSlug={shell.defaultOrgSlug}
        defaultLeagueSlug={shell.defaultLeagueSlug}
        defaultOrgId={shell.defaultOrgId}
        defaultLeagueId={shell.defaultLeagueId}
        defaultLeaguePlayerId={shell.defaultLeaguePlayerId}
      />
    </>
  );
}
