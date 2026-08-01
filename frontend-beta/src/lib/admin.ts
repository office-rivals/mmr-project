import { HttpError } from '@/lib/http-error';
import { isModeratorOrAbove } from '@/lib/utils';
import type { OrganizationRole } from '@/api-v3';
import type { AuthedShellData } from '@/lib/shell';

/**
 * The `{ org, orgId, orgSlug, orgRole }` bundle the SvelteKit
 * `admin/[orgSlug]/+layout.server.ts` exposed to every descendant.
 */
export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
}

/**
 * The only real authorization gate in the admin tree.
 *
 * Order matters and is asserted by `admin-rbac.spec.ts`:
 *  - `getMe()` itself failed  → 401 (the `/admin` layout's only failure mode)
 *  - the org is not in `me`   → 404 (not a member at all)
 *  - the role is `Member`     → 403
 *
 * The lookup is against the `me` payload, never a per-org server call, so an
 * org the user does not belong to is indistinguishable from one that does not
 * exist — deliberately.
 */
export function resolveAdminOrg(
  shell: AuthedShellData,
  orgSlug: string
): AdminOrg {
  if (shell.profileLoadFailed) {
    throw new HttpError(401, 'Failed to load user profile');
  }

  const org = shell.organizations.find((o) => o.slug === orgSlug);
  if (!org) throw new HttpError(404, `Organization '${orgSlug}' not found`);

  if (!isModeratorOrAbove(org.role)) {
    throw new HttpError(403, 'Admin access requires Owner or Moderator role');
  }

  return { id: org.id, name: org.name, slug: org.slug, role: org.role };
}
