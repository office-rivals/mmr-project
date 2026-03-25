<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '$lib/components/ui/card';
  import { Check, Copy, Link, Plus, Trash2, UserPlus } from 'lucide-svelte';
  import { Alert } from '$lib/components/ui/alert';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const isOwner = data.org.role === 'Owner';
  const isModeratorOrAbove =
    data.org.role === 'Owner' || data.org.role === 'Moderator';

  let showCreateLink = $state(false);
  let copiedCode = $state<string | null>(null);

  function getRoleBadgeVariant(role: string) {
    if (role === 'Owner') return 'default';
    if (role === 'Moderator') return 'secondary';
    return 'outline';
  }

  function getStatusBadgeVariant(status: string) {
    if (status === 'Active') return 'default';
    return 'outline';
  }

  async function copyInviteLink(code: string) {
    const url = `${$page.url.origin}/join/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      copiedCode = code;
      setTimeout(() => (copiedCode = null), 2000);
    } catch {
      alert(`Invite link: ${url}`);
    }
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  }
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold tracking-tight">Members</h1>
    <p class="text-muted-foreground text-sm">
      Manage members of {data.org.name}
    </p>
  </div>

  {#if form?.error}
    <Alert variant="destructive">{form.error}</Alert>
  {/if}
  {#if form?.success}
    <Alert variant="success">{form.success}</Alert>
  {/if}

  {#if isModeratorOrAbove}
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Link class="h-5 w-5" />
          Invite Links
        </CardTitle>
        <CardDescription>
          Share an invite link to let people join {data.org.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-4">
          {#if data.inviteLinks.length > 0}
            <div class="space-y-2">
              {#each data.inviteLinks as link}
                <div class="flex items-center justify-between rounded-lg border p-3">
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                      <code class="bg-muted rounded px-2 py-0.5 font-mono text-sm tracking-widest">
                        {link.code}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 w-7 p-0"
                        onclick={() => copyInviteLink(link.code)}
                      >
                        {#if copiedCode === link.code}
                          <Check class="h-3.5 w-3.5" />
                        {:else}
                          <Copy class="h-3.5 w-3.5" />
                        {/if}
                      </Button>
                    </div>
                    <p class="text-muted-foreground text-xs">
                      {link.useCount}{link.maxUses ? `/${link.maxUses}` : ''} uses
                      {#if link.expiresAt}
                        · Expires {formatDate(link.expiresAt)}
                      {/if}
                    </p>
                  </div>
                  <form method="POST" action="?/deleteInviteLink" use:enhance>
                    <input type="hidden" name="linkId" value={link.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      class="text-destructive hover:text-destructive h-8 w-8 p-0"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              {/each}
            </div>
          {/if}

          {#if !showCreateLink}
            <Button
              variant="outline"
              class="w-fit gap-2"
              onclick={() => (showCreateLink = true)}
            >
              <Plus class="h-4 w-4" />
              Create Invite Link
            </Button>
          {:else}
            <form
              method="POST"
              action="?/createInviteLink"
              use:enhance={() => {
                return async ({ update }) => {
                  await update();
                  showCreateLink = false;
                };
              }}
              class="border-muted flex flex-col gap-4 rounded-lg border p-4"
            >
              <div class="flex gap-4">
                <div class="flex-1 space-y-2">
                  <Label for="maxUses">Max Uses (optional)</Label>
                  <Input
                    id="maxUses"
                    name="maxUses"
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                  />
                </div>
                <div class="flex-1 space-y-2">
                  <Label for="expiresAt">Expires (optional)</Label>
                  <Input id="expiresAt" name="expiresAt" type="datetime-local" />
                </div>
              </div>
              <div class="flex gap-2">
                <Button type="submit">Create</Button>
                <Button
                  type="button"
                  variant="outline"
                  onclick={() => (showCreateLink = false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          {/if}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <UserPlus class="h-5 w-5" />
          Invite by Email
        </CardTitle>
        <CardDescription>
          Invite a specific person to {data.org.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          method="POST"
          action="?/invite"
          use:enhance
          class="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div class="flex-1 space-y-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="user@example.com"
              required
            />
          </div>
          <div class="w-full space-y-2 sm:w-40">
            <Label for="role">Role</Label>
            <select
              id="role"
              name="role"
              class="border-input bg-background ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="Member">Member</option>
              <option value="Moderator">Moderator</option>
              {#if isOwner}
                <option value="Owner">Owner</option>
              {/if}
            </select>
          </div>
          <Button type="submit">Invite</Button>
        </form>
      </CardContent>
    </Card>
  {/if}

  <Card>
    <CardHeader>
      <CardTitle>Current Members</CardTitle>
      <CardDescription>
        {data.members.length} member{data.members.length !== 1 ? 's' : ''}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div class="space-y-3">
        {#each data.members as member}
          <div
            class="flex items-center justify-between rounded-lg border p-3"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium">
                  {member.displayName || member.username || member.email || 'Unknown'}
                </span>
                <Badge variant={getRoleBadgeVariant(member.role)}>
                  {member.role}
                </Badge>
                <Badge variant={getStatusBadgeVariant(member.status)}>
                  {member.status}
                </Badge>
              </div>
              {#if member.email}
                <p class="text-muted-foreground truncate text-sm">
                  {member.email}
                </p>
              {/if}
            </div>

            {#if isModeratorOrAbove}
              <div class="ml-4 flex items-center gap-2">
                <form method="POST" action="?/updateRole" use:enhance>
                  <input
                    type="hidden"
                    name="membershipId"
                    value={member.id}
                  />
                  <select
                    name="role"
                    class="border-input bg-background h-8 rounded-md border px-2 text-sm"
                    onchange={(e) => e.currentTarget.form?.requestSubmit()}
                    value={member.role}
                  >
                    <option value="Member">Member</option>
                    <option value="Moderator">Moderator</option>
                    {#if isOwner}
                      <option value="Owner">Owner</option>
                    {/if}
                  </select>
                </form>
                <form method="POST" action="?/remove" use:enhance>
                  <input
                    type="hidden"
                    name="membershipId"
                    value={member.id}
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    class="text-destructive hover:text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </form>
              </div>
            {/if}
          </div>
        {/each}
        {#if data.members.length === 0}
          <p class="text-muted-foreground py-4 text-center text-sm">
            No members yet
          </p>
        {/if}
      </div>
    </CardContent>
  </Card>
</div>
