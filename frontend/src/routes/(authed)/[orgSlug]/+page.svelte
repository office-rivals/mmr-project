<script lang="ts">
  import { enhance } from '$app/forms';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Alert } from '$lib/components/ui/alert';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '$lib/components/ui/card';
  import { CircleUserRound, Clock3, Trophy, Users } from 'lucide-svelte';
  import { formatLeagueFormat } from '$lib/utils';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const claimPending = $derived(data.claimRequest?.status === 'Pending');
</script>

<div class="space-y-6">
  <div class="space-y-1">
    <h1 class="text-2xl font-bold tracking-tight">{data.org.name}</h1>
    <p class="text-sm text-muted-foreground">
      Browse leagues in this organization and join the ones you want to play in.
    </p>
  </div>

  {#if form?.error}
    <Alert variant="destructive">{form.error}</Alert>
  {/if}

  {#if claimPending}
    <div
      class="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm"
    >
      <Clock3 class="h-4 w-4 text-muted-foreground" />
      <span>Player claim awaiting approval</span>
      <Badge variant="outline" class="ml-auto">Pending</Badge>
    </div>
  {:else if data.claimable.requesterEligible}
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <CircleUserRound class="h-5 w-5" />
          Played here before you had an account?
        </CardTitle>
        <CardDescription>
          Claim your player to keep the matches and rating already recorded for
          you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button href={`/${data.org.slug}/claim`}>Claim your player</Button>
      </CardContent>
    </Card>
  {/if}

  <div class="grid gap-4">
    {#each data.leagues as league}
      <Card>
        <CardHeader class="flex flex-row items-start justify-between gap-3">
          <div class="space-y-1">
            <CardTitle class="flex items-center gap-2">
              <Trophy class="h-4 w-4" />
              {league.name}
            </CardTitle>
            <CardDescription>
              {formatLeagueFormat(league.teamSize)}
            </CardDescription>
          </div>
          <Badge variant={league.isJoined ? 'default' : 'outline'}>
            {league.isJoined ? 'Joined' : 'Available'}
          </Badge>
        </CardHeader>
        <CardContent class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Users class="h-4 w-4" />
            <span>{league.slug}</span>
          </div>

          {#if league.isJoined}
            <Button href={`/${data.org.slug}/${league.slug}`}>
              Open League
            </Button>
          {:else if !claimPending}
            <form method="POST" action="?/joinLeague" use:enhance>
              <input type="hidden" name="leagueId" value={league.id} />
              <input type="hidden" name="leagueSlug" value={league.slug} />
              <Button type="submit">Join League</Button>
            </form>
          {/if}
        </CardContent>
      </Card>
    {/each}
  </div>
</div>
