import { HttpError } from '@/lib/http-error';
import { isModeratorOrAbove } from '@/lib/utils';
import type { OrganizationRole } from '@/api-v3';
import type { AuthedShellData } from '@/lib/shell';

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
}

// Membership lookup keeps absent and inaccessible organizations indistinguishable.
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
