import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import { OrganizationRole } from '@/api-v3';
import { HttpError } from '@/lib/http-error';
import {
  failServerAction,
  nativeFormResponse,
  parseNativeFormData,
} from '@/lib/server/action-result';
import { createRouteGuard } from '@/lib/server/http-error';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { loadShellData, loadShellDataOnce } from '@/lib/server/shell';
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
  if (org.role !== OrganizationRole.Owner) {
    throw new HttpError(403, 'Only organization owners can access settings');
  }
  return org;
}

const ownerGuard = createRouteGuard(async ({ params }) => {
  resolveOwnedOrg(await loadShellDataOnce(), params.orgSlug ?? '');
});

type UpdateResult =
  | { status: 'error'; error: string }
  | { status: 'success' }
  | { status: 'renamed'; slug: string };

interface UpdateOrganizationInput {
  orgSlug: string;
  name: string;
  slug: string;
}

/**
 * Closes the hole the Svelte action left open: its `update` action never
 * re-checked the Owner role, so a non-Owner's direct POST reached the API. The
 * gate is repeated here, server-side, on every call.
 */
async function updateOrganization(
  data: UpdateOrganizationInput
): Promise<UpdateResult> {
  const shell = await loadShellData();
  if (shell.profileLoadFailed) {
    return failServerAction(500, {
      status: 'error',
      error: 'Failed to load user profile',
    });
  }
  const org = shell.organizations.find((o) => o.slug === data.orgSlug);
  if (!org) {
    return failServerAction(404, {
      status: 'error',
      error: 'Organization not found',
    });
  }
  if (org.role !== OrganizationRole.Owner) {
    return failServerAction(403, {
      status: 'error',
      error: 'Only organization owners can access settings',
    });
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
    const { status, message } = await getApiErrorDetails(
      error,
      'Failed to update organization'
    );
    return failServerAction(status, { status: 'error', error: message });
  }
}

const updateOrganizationFn = createServerFn({ method: 'POST' })
  .validator((input: UpdateOrganizationInput) => input)
  .handler(({ data }): Promise<UpdateResult> => updateOrganization(data));

export const Route = createFileRoute('/_authed/$orgSlug/settings')({
  validateSearch: (
    search: Record<string, unknown>
  ): { actionSuccess?: string } => ({
    ...(typeof search.actionSuccess === 'string'
      ? { actionSuccess: search.actionSuccess }
      : {}),
  }),
  server: {
    middleware: [ownerGuard],
    handlers: {
      POST: async ({ request, params }) => {
        const formData = await parseNativeFormData(request);
        if (formData.get('_action') !== 'update') {
          return new Response('Unsupported form action', { status: 400 });
        }
        const result = await updateOrganization({
          orgSlug: params.orgSlug,
          name: String(formData.get('name') ?? ''),
          slug: String(formData.get('slug') ?? ''),
        });
        if (result.status === 'renamed') {
          return new Response(null, {
            status: 303,
            headers: { location: `/${result.slug}/settings` },
          });
        }
        return nativeFormResponse(
          request,
          result.status === 'error'
            ? result
            : { success: 'Organization updated successfully' }
        );
      },
    },
  },
  loader: async ({ context, params }) => {
    const shell = context.authedShell;
    return { org: resolveOwnedOrg(shell, params.orgSlug) };
  },
  errorComponent: HttpErrorView,
  component: OrgSettingsPage,
});

function OrgSettingsPage() {
  const { org } = Route.useLoaderData();

  return <OrgSettingsForm key={org.id} />;
}

function OrgSettingsForm() {
  const { org } = Route.useLoaderData();
  const search = Route.useSearch();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(() => !!search.actionSuccess);

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
      // The URL has to follow the rename, otherwise the loader would 404 on the
      // stale slug the moment anything re-runs.
      if (result.status === 'renamed') {
        setSuccess(false);
        await router.navigate({ href: `/${result.slug}/settings` });
        return;
      }

      setSuccess(true);
      await router.invalidate({ sync: true });
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
            method="post"
            action={`/${org.slug}/settings`}
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
            <input type="hidden" name="_action" value="update" />
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
