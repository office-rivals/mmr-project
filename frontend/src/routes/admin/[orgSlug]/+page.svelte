<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '$lib/components/ui/card';
  import { Flag, Trophy, UserCircle, Users } from 'lucide-svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold tracking-tight">{data.org.name}</h1>
    <p class="text-sm text-muted-foreground">
      Overview of activity in this organization.
    </p>
  </div>

  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <Card>
      <CardHeader
        class="flex flex-row items-center justify-between space-y-0 pb-2"
      >
        <CardTitle class="text-sm font-medium">Leagues</CardTitle>
        <Trophy class="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div class="text-2xl font-bold">{data.leagueCount}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader
        class="flex flex-row items-center justify-between space-y-0 pb-2"
      >
        <CardTitle class="text-sm font-medium">Active members</CardTitle>
        <Users class="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div class="text-2xl font-bold">{data.activeMemberCount}</div>
        <p class="text-xs text-muted-foreground">
          {data.ownerCount} Owner{data.ownerCount === 1 ? '' : 's'}
          · {data.moderatorCount} Mod{data.moderatorCount === 1 ? '' : 's'}
          · {data.memberCount} Member{data.memberCount === 1 ? '' : 's'}
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader
        class="flex flex-row items-center justify-between space-y-0 pb-2"
      >
        <CardTitle class="text-sm font-medium">Open match flags</CardTitle>
        <Flag class="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div class="text-2xl font-bold">{data.openFlagsTotal}</div>
        <p class="text-xs text-muted-foreground">across all leagues</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader
        class="flex flex-row items-center justify-between space-y-0 pb-2"
      >
        <CardTitle class="text-sm font-medium">Your role</CardTitle>
        <UserCircle class="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <Badge variant={data.orgRole === 'Owner' ? 'default' : 'secondary'}>
          {data.orgRole}
        </Badge>
      </CardContent>
    </Card>
  </div>

  <Card>
    <CardHeader>
      <CardTitle>Leagues</CardTitle>
      <CardDescription>
        Manage matches, flags and seasons inside each league.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {#if data.leagues.length === 0}
        <p class="py-4 text-center text-sm text-muted-foreground">
          No leagues yet. Create one from the league list.
        </p>
      {:else}
        <div class="space-y-2">
          {#each data.leagues as league}
            {@const openFlags = data.openFlagsPerLeague[league.id] ?? 0}
            <a
              href={`/admin/${data.orgSlug}/leagues/${league.slug}`}
              class="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent/40"
            >
              <div>
                <div class="font-medium">{league.name}</div>
                <p class="text-xs text-muted-foreground">
                  Queue size {league.queueSize} · {league.slug}
                </p>
              </div>
              <div class="flex items-center gap-2">
                {#if openFlags > 0}
                  <Badge variant="destructive">
                    <Flag class="mr-1 h-3 w-3" />
                    {openFlags} open
                  </Badge>
                {/if}
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </CardContent>
  </Card>

  <div class="flex flex-wrap gap-2">
    <Button href={`/admin/${data.orgSlug}/members`} variant="outline">
      Manage members
    </Button>
    <Button href={`/admin/${data.orgSlug}/leagues`} variant="outline">
      Manage leagues
    </Button>
  </div>
</div>
