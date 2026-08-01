import { createFileRoute, redirect } from '@tanstack/react-router';
import { Building2, Ticket, Trophy } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { authedShellQueryOptions } from '@/lib/shell';

/**
 * `/` — org list, or a straight jump into the only league the user plays in.
 *
 * A failed `getMe()` renders the empty state, never an error page: the shell
 * loader turns the failure into `organizations: []`.
 */
export const Route = createFileRoute('/_authed/')({
  loader: async ({ context }) => {
    const shell = await context.queryClient.ensureQueryData(
      authedShellQueryOptions()
    );

    const organizations = shell.organizations.map((org) => ({
      name: org.name,
      slug: org.slug,
      leagues: (org.leagues ?? []).map((league) => ({
        name: league.name,
        slug: league.slug,
      })),
    }));

    // Exactly one org with exactly one league — go straight there. 307, i.e.
    // temporary: joining a second league must bring the list back.
    if (organizations.length === 1 && organizations[0].leagues.length === 1) {
      const org = organizations[0];
      throw redirect({
        href: `/${org.slug}/${org.leagues[0].slug}`,
        statusCode: 307,
      });
    }

    return { organizations };
  },
  component: RootPage,
});

function RootPage() {
  const { organizations } = Route.useLoaderData();

  if (organizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Welcome to Office Rivals</h1>
          <p className="max-w-md text-muted-foreground">
            You&apos;re not a member of any organizations yet. Ask someone to
            invite you, or join with an invite code.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <AppLink to="/join">
            <Ticket className="h-4 w-4" />
            Join with Invite Code
          </AppLink>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Your Organizations</PageTitle>
      <div className="flex flex-col gap-4">
        {organizations.map((org) => (
          <div key={org.slug} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{org.name}</h2>
              <Button asChild variant="ghost">
                <AppLink to={`/${org.slug}`}>Browse Leagues</AppLink>
              </Button>
            </div>
            {org.leagues.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {org.leagues.map((league) => (
                  <Button
                    key={league.slug}
                    asChild
                    variant="outline"
                    className="justify-start gap-2"
                  >
                    <AppLink to={`/${org.slug}/${league.slug}`}>
                      <Trophy className="h-4 w-4" />
                      {league.name}
                    </AppLink>
                  </Button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                You have not joined any leagues in this organization yet.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
