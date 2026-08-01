import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router';
import { ArrowRight, Building2, ShieldAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getRoleBadgeVariant, isModeratorOrAbove } from '@/lib/utils';

const adminRoute = getRouteApi('/admin');

// No loader: the page consumes the `/admin` layout's data, exactly like the
// Svelte `+page.svelte` with no `+page.server.ts`.
export const Route = createFileRoute('/admin/')({
  component: AdminLandingPage,
});

function AdminLandingPage() {
  const shell = adminRoute.useLoaderData();
  const organizations = shell.organizations;
  const adminableOrgs = organizations.filter((org) =>
    isModeratorOrAbove(org.role)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Site administration
        </h1>
        <p className="text-sm text-muted-foreground">
          Super-admin tools (organization management, cross-org users, deletion)
          are coming. Until then, pick an organization below to manage it.
        </p>
      </div>

      <Alert variant="default">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-medium">Super-admin features pending</p>
            <p className="text-muted-foreground">
              Listing every organization, creating new orgs, soft-deleting orgs,
              and toggling super-admin flags will live here once the role is
              implemented on the backend.
            </p>
          </div>
        </div>
      </Alert>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Organizations you can administer
        </h2>

        {adminableOrgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You aren&apos;t an Owner or Moderator of any organization.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {adminableOrgs.map((org) => (
              <Link
                key={org.id}
                to="/admin/$orgSlug"
                params={{ orgSlug: org.slug }}
                className="block"
              >
                <Card className="h-full transition-colors hover:bg-accent/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {org.name}
                    </CardTitle>
                    <CardDescription>{org.slug}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <Badge variant={getRoleBadgeVariant(org.role)}>
                      {org.role}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {organizations.length > adminableOrgs.length && (
          <p className="text-sm text-muted-foreground">
            You&apos;re a Member in some organizations that aren&apos;t shown
            here — only Owners and Moderators can use the admin panel.
          </p>
        )}
      </section>

      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link to="/">Back to app</Link>
        </Button>
      </div>
    </div>
  );
}
