<script lang="ts">
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
  import { ArrowRight, Building2, ShieldAlert } from 'lucide-svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const adminableOrgs = $derived(
    (data.me.organizations ?? []).filter(
      (org) => org.role === 'Owner' || org.role === 'Moderator'
    )
  );
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold tracking-tight">Site administration</h1>
    <p class="text-sm text-muted-foreground">
      Super-admin tools (organization management, cross-org users, deletion) are
      coming. Until then, pick an organization below to manage it.
    </p>
  </div>

  <Alert variant="default">
    <div class="flex items-start gap-2">
      <ShieldAlert class="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div class="text-sm">
        <p class="font-medium">Super-admin features pending</p>
        <p class="text-muted-foreground">
          Listing every organization, creating new orgs, soft-deleting orgs, and
          toggling super-admin flags will live here once the role is implemented
          on the backend.
        </p>
      </div>
    </div>
  </Alert>

  <section class="space-y-3">
    <h2 class="text-lg font-semibold">Organizations you can administer</h2>

    {#if adminableOrgs.length === 0}
      <p class="text-sm text-muted-foreground">
        You aren't an Owner or Moderator of any organization.
      </p>
    {:else}
      <div class="grid gap-3 sm:grid-cols-2">
        {#each adminableOrgs as org}
          <a href={`/admin/${org.slug}`} class="block">
            <Card class="h-full transition-colors hover:bg-accent/40">
              <CardHeader>
                <CardTitle class="flex items-center gap-2">
                  <Building2 class="h-4 w-4" />
                  {org.name}
                </CardTitle>
                <CardDescription>{org.slug}</CardDescription>
              </CardHeader>
              <CardContent class="flex items-center justify-between">
                <Badge variant={org.role === 'Owner' ? 'default' : 'secondary'}>
                  {org.role}
                </Badge>
                <ArrowRight class="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </a>
        {/each}
      </div>
    {/if}

    {#if (data.me.organizations ?? []).length > adminableOrgs.length}
      <p class="text-sm text-muted-foreground">
        You're a Member in some organizations that aren't shown here — only
        Owners and Moderators can use the admin panel.
      </p>
    {/if}
  </section>

  <div class="flex gap-2">
    <Button href="/" variant="outline">Back to app</Button>
  </div>
</div>
