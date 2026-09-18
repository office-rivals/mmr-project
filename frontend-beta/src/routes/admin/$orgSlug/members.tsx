import { useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
  Check,
  Copy,
  Link as LinkIcon,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HttpErrorView } from '@/components/http-error-view';
import {
  failServerAction,
  nativeFormResponse,
  parseNativeFormData,
} from '@/lib/server/action-result';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { requireAdminOrg, resolveOrgIdBySlug } from '@/lib/server/admin';
import {
  formatDate,
  getRoleBadgeVariant,
  isModeratorOrAbove,
} from '@/lib/utils';
import type {
  InviteLinkResponse,
  OrganizationMemberResponse,
  OrganizationRole,
} from '@/api-v3';

// Fixed messages keep submitted fields out of native error documents.
type ActionResult = { error?: string; success?: string };

interface InviteMemberInput {
  orgSlug: string;
  email: string;
  role: string;
  displayName: string;
  username: string;
}

const loadMembersFn = createServerFn({ method: 'GET' })
  .validator((orgSlug: string) => orgSlug)
  .handler(
    async ({
      data: orgSlug,
    }): Promise<{
      members: OrganizationMemberResponse[];
      inviteLinks: InviteLinkResponse[];
    }> => {
      const org = await requireAdminOrg(orgSlug);
      const apiClientV3 = await requireApiClientV3();

      const [members, inviteLinks] = await Promise.all([
        apiClientV3.organizationMembersApi.listMembers(org.id),
        apiClientV3.organizationInviteLinksApi.listInviteLinks(org.id),
      ]);

      return { members, inviteLinks };
    }
  );

async function inviteMember(data: InviteMemberInput): Promise<ActionResult> {
  const apiClientV3 = await requireApiClientV3();
  const orgId = await resolveOrgIdBySlug(apiClientV3, data.orgSlug);
  if (!orgId) return failServerAction(404, { error: 'Organization not found' });

  try {
    await apiClientV3.organizationMembersApi.inviteMember(orgId, {
      email: data.email,
      role: data.role as OrganizationRole,
      displayName: data.displayName.trim() || undefined,
      username: data.username.trim() || undefined,
    });
    return { success: 'Member invited successfully' };
  } catch {
    return failServerAction(400, { error: 'Failed to invite member' });
  }
}

const inviteMemberFn = createServerFn({ method: 'POST' })
  .validator((input: InviteMemberInput) => input)
  .handler(({ data }): Promise<ActionResult> => inviteMember(data));

interface UpdateMemberRoleInput {
  orgSlug: string;
  membershipId: string;
  role: string;
}

async function updateMemberRole(
  data: UpdateMemberRoleInput
): Promise<ActionResult> {
  const apiClientV3 = await requireApiClientV3();
  const orgId = await resolveOrgIdBySlug(apiClientV3, data.orgSlug);
  if (!orgId) return failServerAction(404, { error: 'Organization not found' });

  try {
    await apiClientV3.organizationMembersApi.updateMemberRole(
      orgId,
      data.membershipId,
      { role: data.role as OrganizationRole }
    );
    return { success: 'Role updated successfully' };
  } catch {
    return failServerAction(400, { error: 'Failed to update role' });
  }
}

const updateMemberRoleFn = createServerFn({ method: 'POST' })
  .validator((input: UpdateMemberRoleInput) => input)
  .handler(({ data }): Promise<ActionResult> => updateMemberRole(data));

const updateMemberProfileFn = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      orgSlug: string;
      membershipId: string;
      displayName: string;
      username: string;
      email: string | null;
    }) => input
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const apiClientV3 = await requireApiClientV3();
    const orgId = await resolveOrgIdBySlug(apiClientV3, data.orgSlug);
    if (!orgId)
      return failServerAction(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationMembersApi.updateMemberProfile(
        orgId,
        data.membershipId,
        {
          displayName: data.displayName.trim(),
          username: data.username.trim(),
          email: data.email == null ? undefined : data.email.trim(),
        }
      );
      return { success: 'Profile updated successfully' };
    } catch {
      return failServerAction(400, { error: 'Failed to update profile' });
    }
  });

interface RemoveMemberInput {
  orgSlug: string;
  membershipId: string;
}

async function removeMember(data: RemoveMemberInput): Promise<ActionResult> {
  const apiClientV3 = await requireApiClientV3();
  const orgId = await resolveOrgIdBySlug(apiClientV3, data.orgSlug);
  if (!orgId) return failServerAction(404, { error: 'Organization not found' });

  try {
    await apiClientV3.organizationMembersApi.removeMember(
      orgId,
      data.membershipId
    );
    return { success: 'Member removed successfully' };
  } catch {
    return failServerAction(400, { error: 'Failed to remove member' });
  }
}

const removeMemberFn = createServerFn({ method: 'POST' })
  .validator((input: RemoveMemberInput) => input)
  .handler(({ data }): Promise<ActionResult> => removeMember(data));

const createInviteLinkFn = createServerFn({ method: 'POST' })
  .validator(
    (input: { orgSlug: string; maxUses: string; expiresAt: string }) => input
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const apiClientV3 = await requireApiClientV3();
    const orgId = await resolveOrgIdBySlug(apiClientV3, data.orgSlug);
    if (!orgId)
      return failServerAction(404, { error: 'Organization not found' });

    try {
      await apiClientV3.organizationInviteLinksApi.createInviteLink(orgId, {
        maxUses: data.maxUses ? parseInt(data.maxUses) : undefined,
        expiresAt: data.expiresAt
          ? new Date(data.expiresAt).toISOString()
          : undefined,
      });
      return { success: 'Invite link created' };
    } catch {
      return failServerAction(400, { error: 'Failed to create invite link' });
    }
  });

interface DeleteInviteLinkInput {
  orgSlug: string;
  linkId: string;
}

async function deleteInviteLink(
  data: DeleteInviteLinkInput
): Promise<ActionResult> {
  const apiClientV3 = await requireApiClientV3();
  const orgId = await resolveOrgIdBySlug(apiClientV3, data.orgSlug);
  if (!orgId) return failServerAction(404, { error: 'Organization not found' });

  try {
    await apiClientV3.organizationInviteLinksApi.deleteInviteLink(
      orgId,
      data.linkId
    );
    return { success: 'Invite link deleted' };
  } catch {
    return failServerAction(400, { error: 'Failed to delete invite link' });
  }
}

const deleteInviteLinkFn = createServerFn({ method: 'POST' })
  .validator((input: DeleteInviteLinkInput) => input)
  .handler(({ data }): Promise<ActionResult> => deleteInviteLink(data));

export const Route = createFileRoute('/admin/$orgSlug/members')({
  validateSearch: (
    search: Record<string, unknown>
  ): { actionSuccess?: string } => ({
    ...(typeof search.actionSuccess === 'string'
      ? { actionSuccess: search.actionSuccess }
      : {}),
  }),
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const formData = await parseNativeFormData(request);
        let actionResult: ActionResult;
        try {
          switch (formData.get('_action')) {
            case 'invite':
              actionResult = await inviteMember({
                orgSlug: params.orgSlug,
                email: String(formData.get('email') ?? ''),
                role: String(formData.get('role') ?? ''),
                displayName: String(formData.get('displayName') ?? ''),
                username: String(formData.get('username') ?? ''),
              });
              break;
            case 'deleteInviteLink':
              actionResult = await deleteInviteLink({
                orgSlug: params.orgSlug,
                linkId: String(formData.get('linkId') ?? ''),
              });
              break;
            case 'updateRole':
              actionResult = await updateMemberRole({
                orgSlug: params.orgSlug,
                membershipId: String(formData.get('membershipId') ?? ''),
                role: String(formData.get('role') ?? ''),
              });
              break;
            case 'remove':
              actionResult = await removeMember({
                orgSlug: params.orgSlug,
                membershipId: String(formData.get('membershipId') ?? ''),
              });
              break;
            default:
              return new Response('Unsupported form action', { status: 400 });
          }
        } catch {
          actionResult = failServerAction(500, {
            error: 'Request failed. Please try again.',
          });
        }
        return nativeFormResponse(request, actionResult);
      },
    },
  },
  loader: ({ params }) => loadMembersFn({ data: params.orgSlug }),
  errorComponent: HttpErrorView,
  component: MembersPage,
});

const getStatusBadgeVariant = (status: string) =>
  status === 'Active' ? ('default' as const) : ('outline' as const);

function MembersPage() {
  const { org } = Route.useRouteContext();
  const { members, inviteLinks } = Route.useLoaderData();
  const search = Route.useSearch();
  const router = useRouter();

  const [result, setResult] = useState<ActionResult | null>(() =>
    search.actionSuccess ? { success: search.actionSuccess } : null
  );
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(
    null
  );

  const isOwner = org.role === 'Owner';
  const canModerate = isModeratorOrAbove(org.role);

  const run = async (
    action: Promise<ActionResult>,
    beforeRefresh?: () => void
  ) => {
    let actionResult: ActionResult;
    try {
      actionResult = await action;
    } catch {
      actionResult = { error: 'Request failed. Please try again.' };
    }
    if (actionResult.success) {
      beforeRefresh?.();
      await router.invalidate({ sync: true });
    }
    setResult(actionResult);
    return actionResult;
  };

  async function copyInviteLink(code: string) {
    const url = `${window.location.origin}/join/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      window.alert(`Invite link: ${url}`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Members</h1>
        <p className="text-sm text-muted-foreground">
          {`Manage members of ${org.name}`}
        </p>
      </div>

      {result?.error && <Alert variant="destructive">{result.error}</Alert>}
      {result?.success && <Alert variant="success">{result.success}</Alert>}

      {canModerate && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Invite Links
              </CardTitle>
              <CardDescription>
                {`Share an invite link to let people join ${org.name}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {inviteLinks.length > 0 && (
                  <div className="space-y-2">
                    {inviteLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm tracking-widest">
                              {link.code}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => copyInviteLink(link.code)}
                            >
                              {copiedCode === link.code ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {`${link.useCount}${link.maxUses ? `/${link.maxUses}` : ''} uses${
                              link.expiresAt
                                ? ` · Expires ${formatDate(link.expiresAt, 'Never')}`
                                : ''
                            }`}
                          </p>
                        </div>
                        <form
                          method="post"
                          action={`/admin/${org.slug}/members`}
                          onSubmit={(event) => {
                            event.preventDefault();
                            void run(
                              deleteInviteLinkFn({
                                data: { orgSlug: org.slug, linkId: link.id },
                              })
                            );
                          }}
                        >
                          <input
                            type="hidden"
                            name="_action"
                            value="deleteInviteLink"
                          />
                          <input type="hidden" name="linkId" value={link.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}

                {!showCreateLink ? (
                  <Button
                    variant="outline"
                    className="w-fit gap-2"
                    onClick={() => setShowCreateLink(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Create Invite Link
                  </Button>
                ) : (
                  <form
                    className="flex flex-col gap-4 rounded-lg border border-muted p-4"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      await run(
                        createInviteLinkFn({
                          data: {
                            orgSlug: org.slug,
                            maxUses: String(formData.get('maxUses') ?? ''),
                            expiresAt: String(formData.get('expiresAt') ?? ''),
                          },
                        })
                      );
                      setShowCreateLink(false);
                    }}
                  >
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="maxUses">Max Uses (optional)</Label>
                        <Input
                          id="maxUses"
                          name="maxUses"
                          type="number"
                          min="1"
                          placeholder="Unlimited"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="expiresAt">Expires (optional)</Label>
                        <Input
                          id="expiresAt"
                          name="expiresAt"
                          type="datetime-local"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit">Create</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowCreateLink(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Invite by Email
              </CardTitle>
              <CardDescription>
                {`Invite a specific person to ${org.name}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                method="post"
                action={`/admin/${org.slug}/members`}
                className="flex flex-col gap-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const formData = new FormData(form);
                  await run(
                    inviteMemberFn({
                      data: {
                        orgSlug: org.slug,
                        email: String(formData.get('email') ?? ''),
                        role: String(formData.get('role') ?? ''),
                        displayName: String(formData.get('displayName') ?? ''),
                        username: String(formData.get('username') ?? ''),
                      },
                    }),
                    () => form.reset()
                  );
                }}
              >
                <input type="hidden" name="_action" value="invite" />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                  <div className="w-full space-y-2 sm:w-40">
                    <Label htmlFor="role">Role</Label>
                    <select
                      id="role"
                      name="role"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="Member">Member</option>
                      <option value="Moderator">Moderator</option>
                      {isOwner && <option value="Owner">Owner</option>}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="invite-displayName">
                      Display name (optional)
                    </Label>
                    <Input
                      id="invite-displayName"
                      name="displayName"
                      placeholder="Full name"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="invite-username">Username (optional)</Label>
                    <Input
                      id="invite-username"
                      name="username"
                      placeholder="short-handle"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-fit">
                  Invite
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current Members</CardTitle>
          <CardDescription>
            {`${members.length} member${members.length !== 1 ? 's' : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="rounded-lg border p-3">
                {editingMembershipId === member.id ? (
                  <form
                    className="flex flex-col gap-3"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      const rawEmail = formData.get('email');
                      await run(
                        updateMemberProfileFn({
                          data: {
                            orgSlug: org.slug,
                            membershipId: member.id,
                            displayName: String(
                              formData.get('displayName') ?? ''
                            ),
                            username: String(formData.get('username') ?? ''),
                            email: rawEmail == null ? null : String(rawEmail),
                          },
                        })
                      );
                      setEditingMembershipId(null);
                    }}
                  >
                    <input
                      type="hidden"
                      name="membershipId"
                      value={member.id}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor={`displayName-${member.id}`}>
                          Display name
                        </Label>
                        <Input
                          id={`displayName-${member.id}`}
                          name="displayName"
                          defaultValue={member.displayName ?? ''}
                          placeholder="Full name"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`username-${member.id}`}>
                          Username
                        </Label>
                        <Input
                          id={`username-${member.id}`}
                          name="username"
                          defaultValue={member.username ?? ''}
                          placeholder="short-handle"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor={`email-${member.id}`}>Email</Label>
                        {member.userId ? (
                          <>
                            {/* Omit `name` so the server leaves the email alone. */}
                            <Input
                              id={`email-${member.id}`}
                              defaultValue={member.email ?? ''}
                              disabled
                            />
                            <p className="text-xs text-muted-foreground">
                              Linked to a user account — email is owned by the
                              user.
                            </p>
                          </>
                        ) : (
                          <Input
                            id={`email-${member.id}`}
                            name="email"
                            type="email"
                            defaultValue={member.email ?? ''}
                            placeholder="user@example.com"
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm">
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingMembershipId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">
                          {member.displayName ||
                            member.username ||
                            member.email ||
                            'Unknown'}
                        </span>
                        {member.username && (
                          <span className="text-xs text-muted-foreground">
                            {`@${member.username}`}
                          </span>
                        )}
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                        <Badge variant={getStatusBadgeVariant(member.status)}>
                          {member.status}
                        </Badge>
                      </div>
                      {member.email && (
                        <p className="truncate text-sm text-muted-foreground">
                          {member.email}
                        </p>
                      )}
                    </div>

                    {canModerate && (
                      <div className="ml-4 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Edit profile"
                          onClick={() => setEditingMembershipId(member.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <form
                          method="post"
                          action={`/admin/${org.slug}/members`}
                          onSubmit={(event) => event.preventDefault()}
                        >
                          <input
                            type="hidden"
                            name="_action"
                            value="updateRole"
                          />
                          <input
                            type="hidden"
                            name="membershipId"
                            value={member.id}
                          />
                          <select
                            key={`${member.id}-${member.role}`}
                            name="role"
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                            defaultValue={member.role}
                            onChange={(event) => {
                              void run(
                                updateMemberRoleFn({
                                  data: {
                                    orgSlug: org.slug,
                                    membershipId: member.id,
                                    role: event.target.value,
                                  },
                                })
                              );
                            }}
                          >
                            <option value="Member">Member</option>
                            <option value="Moderator">Moderator</option>
                            {isOwner && <option value="Owner">Owner</option>}
                          </select>
                        </form>
                        <form
                          method="post"
                          action={`/admin/${org.slug}/members`}
                          onSubmit={(event) => {
                            event.preventDefault();
                            void run(
                              removeMemberFn({
                                data: {
                                  orgSlug: org.slug,
                                  membershipId: member.id,
                                },
                              })
                            );
                          }}
                        >
                          <input type="hidden" name="_action" value="remove" />
                          <input
                            type="hidden"
                            name="membershipId"
                            value={member.id}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={(event) => {
                              if (
                                !window.confirm(
                                  'Remove this member from the organization?'
                                )
                              ) {
                                event.preventDefault();
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {members.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No members yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
