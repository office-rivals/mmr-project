import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HttpErrorView } from '@/components/http-error-view';
import { HttpError } from '@/lib/http-error';
import { createRouteGuard } from '@/lib/server/http-error';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { loadShellData, loadShellDataOnce } from '@/lib/server/shell';
import { authedShellQueryOptions, meQueryKey } from '@/lib/shell';
import type { AuthedShellData } from '@/lib/shell';

/**
 * Strictly `role === 'Owner'`: a Moderator gets 403, a non-member 404, a
 * profile-load failure 500.
 */
function resolveOwnedOrg(shell: AuthedShellData, orgSlug: string) {
  if (shell.profileLoadFailed) {
    throw new HttpError(500, 'Failed to load user profile');
  }
  const org = shell.organizations.find((o) => o.slug === orgSlug);
  if (!org) throw new HttpError(404, `Organization '${orgSlug}' not found`);
  if (org.role !== 'Owner') {
    throw new HttpError(403, 'Only organization owners can access settings');
  }
  return org;
}

const ownerGuard = createRouteGuard(async ({ params }) => {
  resolveOwnedOrg(await loadShellDataOnce(), params.orgSlug ?? '');
});

async function readProblemDetail(error: unknown): Promise<string | null> {
  const response = (error as { response?: Response } | null)?.response;
  if (!response || typeof response.json !== 'function') return null;
  const body = (await response.json().catch(() => ({}))) as {
    detail?: unknown;
  };
  return typeof body.detail === 'string' ? body.detail : null;
}

type UpdateResult =
  | { status: 'error'; error: string }
  | { status: 'success' }
  | { status: 'renamed'; slug: string };

/**
 * Closes the hole the Svelte action left open: its `update` action never
 * re-checked the Owner role, so a non-Owner's direct POST reached the API. The
 * gate is repeated here, server-side, on every call.
 */
const updateOrganizationFn = createServerFn({ method: 'POST' })
  .validator((input: { orgSlug: string; name: string; slug: string }) => input)
  .handler(async ({ data }): Promise<UpdateResult> => {
    const shell = await loadShellData();
    if (shell.profileLoadFailed) {
      return { status: 'error', error: 'Failed to load user profile' };
    }
    const org = shell.organizations.find((o) => o.slug === data.orgSlug);
    if (!org) return { status: 'error', error: 'Organization not found' };
    if (org.role !== 'Owner') {
      return {
        status: 'error',
        error: 'Only organization owners can access settings',
      };
    }

    const apiClientV3 = await requireApiClientV3();
    try {
      const updated = await apiClientV3.organizationsApi.updateOrganization(
        org.id,
        { name: data.name, slug: data.slug }
      );
      return updated.slug !== data.orgSlug
        ? { status: 'renamed', slug: updated.slug }
        : { status: 'success' };
    } catch (error) {
      const detail = await readProblemDetail(error);
      return {
        status: 'error',
        error: detail ?? 'Failed to update organization',
      };
    }
  });

export const Route = createFileRoute('/_authed/$orgSlug/settings')({
  server: { middleware: [ownerGuard] },
  loader: async ({ context, params }) => {
    const shell = await context.queryClient.ensureQueryData(
      authedShellQueryOptions()
    );
    return { org: resolveOwnedOrg(shell, params.orgSlug) };
  },
  errorComponent: HttpErrorView,
  component: OrgSettingsPage,
});

function OrgSettingsPage() {
  const { org } = Route.useLoaderData();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const updateOrganization = useMutation({
    mutationFn: (input: { name: string; slug: string }) =>
      updateOrganizationFn({ data: { orgSlug: org.slug, ...input } }),
    onSuccess: async (result) => {
      if (result.status === 'error') {
        setError(result.error);
        setSuccess(false);
        return;
      }
      setError(null);
      await queryClient.invalidateQueries({ queryKey: meQueryKey });

      // The URL has to follow the rename, otherwise the loader would 404 on the
      // stale slug the moment anything re-runs.
      if (result.status === 'renamed') {
        setSuccess(false);
        await router.navigate({ href: `/${result.slug}/settings` });
        return;
      }

      setSuccess(true);
      // Re-run the loader so the inputs show the saved values.
      await router.invalidate();
    },
    onError: () => {
      setSuccess(false);
      setError('Failed to update organization');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Organization Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization&apos;s settings
        </p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {success && (
        <Alert variant="success">Organization updated successfully</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            Update your organization&apos;s name and slug
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              updateOrganization.mutate({
                name: String(formData.get('name') ?? ''),
                slug: String(formData.get('slug') ?? ''),
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              {/* `key` forces a remount after a rename/refresh so the
                  uncontrolled input picks up the new server value. */}
              <Input
                key={`name-${org.name}`}
                id="name"
                name="name"
                defaultValue={org.name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                key={`slug-${org.slug}`}
                id="slug"
                name="slug"
                defaultValue={org.slug}
                required
              />
              <p className="text-xs text-muted-foreground">
                Used in URLs. Changing this will update all links.
              </p>
            </div>
            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
