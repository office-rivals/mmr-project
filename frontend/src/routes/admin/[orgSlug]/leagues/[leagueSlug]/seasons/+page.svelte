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
  import { CalendarDays, Plus } from 'lucide-svelte';
  import { formatDateTime } from '$lib/utils';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let showCreate = $state(false);

  const sortedSeasons = $derived(
    [...data.seasons].sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
    )
  );

  // The current season is the most recent one whose startsAt is in the past.
  const currentSeasonId = $derived(
    sortedSeasons.find((s) => new Date(s.startsAt).getTime() <= Date.now())
      ?.id ?? null
  );
</script>

<div class="space-y-4">
  <div class="flex items-end justify-between gap-2">
    <div>
      <h2 class="text-xl font-semibold">Seasons</h2>
      <p class="text-sm text-muted-foreground">
        A new season resets ratings and starts a fresh leaderboard from its
        start date.
      </p>
    </div>
    <Button
      variant={showCreate ? 'ghost' : 'default'}
      onclick={() => (showCreate = !showCreate)}
    >
      <Plus class="mr-2 h-4 w-4" />
      {showCreate ? 'Cancel' : 'New season'}
    </Button>
  </div>

  {#if form?.success}
    <Alert variant="success">{form.message}</Alert>
  {:else if form?.success === false}
    <Alert variant="destructive">{form.message}</Alert>
  {/if}

  {#if showCreate}
    <Card>
      <CardHeader>
        <CardTitle>Start a new season</CardTitle>
        <CardDescription>
          Pick a start date in the future to schedule, or now to start
          immediately.
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
          class="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div class="flex-1 space-y-2">
            <Label for="startsAt">Starts at</Label>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              required
            />
          </div>
          <Button type="submit">Create season</Button>
        </form>
      </CardContent>
    </Card>
  {/if}

  <Card>
    <CardHeader>
      <CardTitle>All seasons</CardTitle>
      <CardDescription>
        {data.seasons.length} season{data.seasons.length === 1 ? '' : 's'} total
      </CardDescription>
    </CardHeader>
    <CardContent>
      {#if sortedSeasons.length === 0}
        <p class="py-6 text-center text-sm text-muted-foreground">
          No seasons yet. Create one to start tracking rated matches.
        </p>
      {:else}
        <div class="space-y-2">
          {#each sortedSeasons as season (season.id)}
            <div
              class="flex items-center justify-between rounded-md border p-3"
            >
              <div class="flex items-center gap-2">
                <CalendarDays class="h-4 w-4 text-muted-foreground" />
                <div>
                  <div class="text-sm font-medium">
                    {formatDateTime(season.startsAt)}
                  </div>
                  <p class="text-xs text-muted-foreground">
                    Created {formatDateTime(season.createdAt)}
                  </p>
                </div>
              </div>
              {#if season.id === currentSeasonId}
                <Badge>Current</Badge>
              {:else if new Date(season.startsAt).getTime() > Date.now()}
                <Badge variant="outline">Scheduled</Badge>
              {:else}
                <Badge variant="secondary">Past</Badge>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
