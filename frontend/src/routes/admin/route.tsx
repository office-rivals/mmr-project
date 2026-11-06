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
import { refreshAuthedShellData } from '@/lib/shell';
import type { BadgesResponse } from '@/api-v3';
import type { AuthedShellData } from '@/lib/shell';

/** The landing is authenticated; organization routes apply role gates. */
function requireProfile(shell: AuthedShellData): AuthedShellData {
  if (shell.profileLoadFailed) {
    throw new HttpError(401, 'Failed to load user profile');
  }
  return shell;
}

const adminGuard = createRouteGuard(async () => {
  requireProfile(await loadShellDataOnce());
});

export interface AdminLayoutData extends AuthedShellData {
  badges: BadgesResponse | null;
}

export const Route = createFileRoute('/admin')({
  server: { middleware: [adminGuard] },
  beforeLoad: async ({ context }) => ({
    adminShell: requireProfile(
      await refreshAuthedShellData(context.queryClient)
    ),
  }),
  loader: async ({ context }): Promise<AdminLayoutData> => {
    const shell = context.adminShell;
    const badges = await context.queryClient
      .fetchQuery(badgesQueryOptions())
      .catch(() => null);
    return { ...shell, badges };
  },
  errorComponent: HttpErrorView,
  component: AdminLayout,
});

function AdminLayout() {
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
                  <Building2 className="mr-2 h-4 w-4" />
                  Open Org
                </AppLink>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
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
