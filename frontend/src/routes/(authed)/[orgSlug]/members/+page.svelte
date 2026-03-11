<script lang="ts">
  import { enhance } from '$app/forms';
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
  import { UserPlus, Trash2 } from 'lucide-svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const isOwner = data.org.role === 'Owner';
  const isModeratorOrAbove =
    data.org.role === 'Owner' || data.org.role === 'Moderator';

  function getRoleBadgeVariant(role: string) {
    if (role === 'Owner') return 'default';
    if (role === 'Moderator') return 'secondary';
    return 'outline';
  }

  function getStatusBadgeVariant(status: string) {
    if (status === 'Active') return 'default';
    return 'outline';
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
    <div class="bg-destructive/15 text-destructive rounded-md p-3 text-sm">
      {form.error}
    </div>
  {/if}
  {#if form?.success}
    <div class="bg-green-500/15 text-green-700 rounded-md p-3 text-sm dark:text-green-400">
      {form.success}
    </div>
  {/if}

  {#if isModeratorOrAbove}
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <UserPlus class="h-5 w-5" />
          Invite Member
        </CardTitle>
        <CardDescription>
          Send an invitation to join {data.org.name}
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
