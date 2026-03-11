<script lang="ts">
  import { enhance } from '$app/forms';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '$lib/components/ui/card';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold tracking-tight">Organization Settings</h1>
    <p class="text-muted-foreground text-sm">
      Manage your organization's settings
    </p>
  </div>

  {#if form?.error}
    <div class="bg-destructive/15 text-destructive rounded-md p-3 text-sm">
      {form.error}
    </div>
  {/if}
  {#if form?.success}
    <div class="bg-green-500/15 text-green-700 rounded-md p-3 text-sm dark:text-green-400">
      Organization updated successfully
    </div>
  {/if}

  <Card>
    <CardHeader>
      <CardTitle>General</CardTitle>
      <CardDescription>Update your organization's name and slug</CardDescription>
    </CardHeader>
    <CardContent>
      <form method="POST" action="?/update" use:enhance class="space-y-4">
        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input id="name" name="name" value={data.org.name} required />
        </div>
        <div class="space-y-2">
          <Label for="slug">Slug</Label>
          <Input id="slug" name="slug" value={data.org.slug} required />
          <p class="text-muted-foreground text-xs">
            Used in URLs. Changing this will update all links.
          </p>
        </div>
        <Button type="submit">Save Changes</Button>
      </form>
    </CardContent>
  </Card>
</div>
