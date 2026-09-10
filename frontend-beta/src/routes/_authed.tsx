import { Outlet, createFileRoute } from '@tanstack/react-router';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { Header } from '@/components/shell/header';
import { Navbar } from '@/components/shell/navbar';
import { authedShellQueryOptions } from '@/lib/shell';

/**
 * The `(authed)` layout: a pathless route that owns the single `getMe()`
 * fan-out plus the app chrome. Every authed page lives under it.
 *
 * The loader must **not** throw when `getMe()` fails — `profileLoadFailed`
 * flows through to children so `/settings` and `/random` degrade while the
 * league layout 401s.
 */
export const Route = createFileRoute('/_authed')({
  head: () => ({
    styles: [
      {
        // Offsets native anchor scrolling (hash landings, `#step` jumps) so the
        // target isn't hidden behind the fixed header, and restores the Svelte
        // layout's `:global(body) { min-height: 100vh }`. Scoped to this
        // route's lifetime on purpose: /login and /admin have no fixed header.
        children:
          'html{scroll-padding-top:calc(env(safe-area-inset-top) + var(--header-height) + 1rem)}body{min-height:100vh}',
      },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(authedShellQueryOptions()),
  component: AuthedLayout,
});

function AuthedLayout() {
  const shell = Route.useLoaderData();

  return (
    <>
      {/* Mounted first, before the header — it is the only consumer of the
          `data-no-pull-to-refresh` opt-out contract. */}
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
