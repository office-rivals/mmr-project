<script lang="ts">
  import { enhance } from '$app/forms';
  import { Alert } from '$lib/components/ui/alert';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Plus, Trophy } from 'lucide-svelte';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const isOwner = $derived(data.org.role === 'Owner');
  let showCreate = $state(false);
</script>

<div class="space-y-6">
  <div class="flex items-end justify-between gap-2">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Leagues</h1>
      <p class="text-sm text-muted-foreground">
        Manage every league in {data.org.name}.
      </p>
    </div>
    {#if isOwner}
      <Button
        variant={showCreate ? 'ghost' : 'default'}
        onclick={() => (showCreate = !showCreate)}
      >
        <Plus class="mr-2 h-4 w-4" />
        {showCreate ? 'Cancel' : 'New league'}
      </Button>
    {/if}
  </div>

  {#if form?.error}
    <Alert variant="destructive">{form.error}</Alert>
  {/if}
  {#if form?.success}
    <Alert variant="success">{form.success}</Alert>
  {/if}

  {#if showCreate && isOwner}
    <Card>
      <CardHeader>
        <CardTitle>New league</CardTitle>
        <CardDescription>
          Slug appears in URLs and cannot be changed easily later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          method="POST"
          action="?/create"
          use:enhance={() => {
            return async ({ update, result }) => {
              await update();
              if (result.type === 'success') showCreate = false;
            };
          }}
          class="grid gap-4 sm:grid-cols-3"
        >
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div class="space-y-2">
            <Label for="slug">Slug</Label>
            <Input id="slug" name="slug" required pattern="[a-z0-9-]+" />
          </div>
          <div class="space-y-2">
            <Label for="queueSize">Queue size</Label>
            <Input
              id="queueSize"
              name="queueSize"
              type="number"
              min="2"
              placeholder="4"
            />
          </div>
          <div class="sm:col-span-3">
            <Button type="submit">Create league</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  {/if}

  <div class="grid gap-3">
    {#each data.leagues as league}
      <a
        href={`/admin/${data.orgSlug}/leagues/${league.slug}`}
        class="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
      >
        <div class="flex items-center gap-3">
          <Trophy class="h-5 w-5 text-muted-foreground" />
          <div>
            <div class="font-medium">{league.name}</div>
            <p class="text-xs text-muted-foreground">{league.slug}</p>
          </div>
        </div>
        <Badge variant="outline">Queue {league.queueSize}</Badge>
      </a>
    {/each}
    {#if data.leagues.length === 0}
      <p class="py-6 text-center text-sm text-muted-foreground">
        No leagues yet.
      </p>
    {/if}
  </div>
</div>
