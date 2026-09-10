import {
  Link,
  Outlet,
  createFileRoute,
  useMatch,
} from '@tanstack/react-router';
import { Building2, Home, Shield } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { HttpErrorView } from '@/components/http-error-view';
import { HttpError } from '@/lib/http-error';
import { createRouteGuard } from '@/lib/server/http-error';
import { loadShellDataOnce } from '@/lib/server/shell';
import { badgesQueryOptions } from '@/lib/badges';
import { authedShellQueryOptions } from '@/lib/shell';
import type { BadgesResponse } from '@/api-v3';
import type { AuthedShellData } from '@/lib/shell';

/**
 * `/admin` is deliberately NOT role-gated — there is a `TODO(super-admin)` on
 * the Svelte layout and any authenticated user may load the landing page. Its
 * only failure mode is `getMe()` itself throwing.
 */
function requireProfile(shell: AuthedShellData): AuthedShellData {
  if (shell.profileLoadFailed) {
    throw new HttpError(401, 'Failed to load user profile');
  }
  return shell;
}

const adminGuard = createRouteGuard(async () => {
  requireProfile(await loadShellDataOnce());
});

/** The `/admin` layout data every descendant reads for its flag badges. */
export interface AdminLayoutData extends AuthedShellData {
  badges: BadgesResponse | null;
}

export const Route = createFileRoute('/admin')({
  server: { middleware: [adminGuard] },
  loader: async ({ context }): Promise<AdminLayoutData> => {
    const shell = requireProfile(
      await context.queryClient.ensureQueryData(authedShellQueryOptions())
    );
    // After getMe(), which provisions the user and claims pending invites —
    // the memberships the counts are derived from. Non-fatal on its own.
    const badges = await context.queryClient
      .ensureQueryData(badgesQueryOptions())
      .catch(() => null);
    return { ...shell, badges };
  },
  errorComponent: HttpErrorView,
  component: AdminLayout,
});

/**
 * Admin chrome. It lives outside `_authed` on purpose: no app header, no bottom
 * navbar, and none of the `_authed` route's `<head>` styles.
 */
function AdminLayout() {
  // `shouldThrow: false` — on `/admin` itself there is no org match at all.
  const orgMatch = useMatch({ from: '/admin/$orgSlug', shouldThrow: false });
  const currentOrg = orgMatch?.loaderData ?? null;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/admin" className="flex items-center gap-2 font-semibold">
            <Shield className="h-5 w-5 text-primary" />
            <span>Admin</span>
          </Link>

          {currentOrg && (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              /{' '}
              <span className="font-medium text-foreground">
                {currentOrg.name}
              </span>
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {currentOrg && (
              <Button asChild variant="ghost" size="sm">
                <AppLink to={`/${currentOrg.slug}`}>
                  <Building2 className="h-4 w-4" />
                  Open Org
                </AppLink>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <Home className="h-4 w-4" />
                Exit Admin
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
