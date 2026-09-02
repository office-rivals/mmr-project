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
  import { CalendarDays, Cpu, Flag, Trophy, Users } from 'lucide-svelte';
  import {
    formatDate,
    formatDateTime,
    formatLeagueFormat,
    getPlayerDisplayName,
  } from '$lib/utils';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="space-y-5">
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <Card>
      <CardHeader
        class="flex flex-row items-center justify-between space-y-0 pb-2"
      >
        <CardTitle class="text-sm font-medium">Current season</CardTitle>
        <CalendarDays class="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {#if data.currentSeason}
          <div class="text-lg font-semibold">
            {formatDate(data.currentSeason.startsAt)}
          </div>
          <p class="text-xs text-muted-foreground">Active since this date</p>
        {:else}
          <div class="text-lg font-semibold">None</div>
        {/if}
      </CardContent>
    </Card>

    <Card>
      <CardHeader
        class="flex flex-row items-center justify-between space-y-0 pb-2"
      >
        <CardTitle class="text-sm font-medium">Players</CardTitle>
        <Users class="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div class="text-2xl font-bold">{data.playerCount}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader
        class="flex flex-row items-center justify-between space-y-0 pb-2"
      >
        <CardTitle class="text-sm font-medium">Format</CardTitle>
        <Trophy class="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div class="text-2xl font-bold">
          {formatLeagueFormat(data.league.teamSize)}
        </div>
        <p class="text-xs text-muted-foreground">
          {data.league.winningScore == null
            ? 'Free-form scoring'
            : `First to ${data.league.winningScore}`}
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader
        class="flex flex-row items-center justify-between space-y-0 pb-2"
      >
        <CardTitle class="text-sm font-medium">Open flags</CardTitle>
        <Flag class="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div class="text-2xl font-bold">{data.openFlagsCount}</div>
      </CardContent>
    </Card>
  </div>

  <Card>
    <CardHeader>
      <CardTitle>Recent matches</CardTitle>
      <CardDescription>Five most recent matches in this league.</CardDescription
      >
    </CardHeader>
    <CardContent>
      {#if data.recentMatches.length === 0}
        <p class="py-4 text-center text-sm text-muted-foreground">
          No matches yet.
        </p>
      {:else}
        <div class="space-y-2">
          {#each data.recentMatches as match (match.id)}
            {@const team1 = match.teams[0]}
            {@const team2 = match.teams[1]}
            <div
              class="flex items-center justify-between rounded-md border p-3"
            >
              <div class="text-sm">
                <span class={team1?.isWinner ? 'font-semibold' : ''}>
                  {(team1?.players ?? [])
                    .map((p) => getPlayerDisplayName(p, '?'))
                    .join(' & ')}
                </span>
                <span class="mx-2 text-muted-foreground">
                  {team1?.score} – {team2?.score}
                </span>
                <span class={team2?.isWinner ? 'font-semibold' : ''}>
                  {(team2?.players ?? [])
                    .map((p) => getPlayerDisplayName(p, '?'))
                    .join(' & ')}
                </span>
              </div>
              <Badge variant="outline">{formatDate(match.playedAt)}</Badge>
            </div>
          {/each}
        </div>
      {/if}
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle>Hardware</CardTitle>
      <CardDescription>Hardware checking in for this league.</CardDescription>
    </CardHeader>
    <CardContent>
      {#if data.hardware.length === 0}
        <p class="py-4 text-center text-sm text-muted-foreground">
          No Hardware has checked in yet.
        </p>
      {:else}
        <div class="space-y-2">
          {#each data.hardware as hardware (hardware.id)}
            <div
              class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
            >
              <div class="flex items-center gap-3">
                <Cpu class="h-4 w-4 text-muted-foreground" />
                <div>
                  <div class="font-mono text-sm">{hardware.hardwareId}</div>
                  <div class="text-xs text-muted-foreground">
                    LAN IP: {hardware.localIpAddress}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3 text-sm">
                <Badge variant={hardware.isOnline ? 'default' : 'outline'}>
                  {hardware.isOnline ? 'Online' : 'Offline'}
                </Badge>
                <span class="text-muted-foreground">
                  Last seen {formatDateTime(hardware.lastSeenAt)}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </CardContent>
  </Card>

  <div class="flex flex-wrap gap-2">
    <Button href={`${data.leagueAdminBase}/matches`} variant="outline">
      All matches
    </Button>
    <Button href={`${data.leagueAdminBase}/match-flags`} variant="outline">
      Match flags
    </Button>
    <Button href={`${data.leagueAdminBase}/seasons`} variant="outline">
      Seasons
    </Button>
  </div>
</div>
