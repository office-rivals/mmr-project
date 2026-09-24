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
  import {
    AlertCircle,
    Ban,
    CalendarDays,
    Check,
    Copy,
    Cpu,
    Flag,
    KeyRound,
    Plus,
    Trophy,
    Users,
  } from 'lucide-svelte';
  import {
    formatDate,
    formatDateTime,
    formatLeagueFormat,
    getPlayerDisplayName,
  } from '$lib/utils';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let showRegister = $state(false);
  let copied = $state(false);

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      alert('Failed to copy to clipboard. Please copy manually.');
    }
  }

  // ponytail: the API stores LastSeenAt as non-nullable, so Hardware that has
  // never sent a heartbeat comes back as 0001-01-01. Make it nullable in the
  // API if more consumers need this.
  const hasCheckedIn = (lastSeenAt: string) =>
    new Date(lastSeenAt).getTime() > 0;
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
    <CardHeader
      class="flex flex-row items-start justify-between gap-2 space-y-0"
    >
      <div class="space-y-1.5">
        <CardTitle>Hardware</CardTitle>
        <CardDescription>
          Randomizer Boxes registered to this league.
        </CardDescription>
      </div>
      <Button
        size="sm"
        variant={showRegister ? 'ghost' : 'default'}
        onclick={() => (showRegister = !showRegister)}
      >
        {#if !showRegister}<Plus class="mr-2 h-4 w-4" />{/if}
        {showRegister ? 'Cancel' : 'Register Hardware'}
      </Button>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if form?.secret}
        {@const secret = form.secret}
        <div
          class="flex flex-col gap-3 rounded-lg border border-l-4 border-primary bg-green-950/20 p-4"
        >
          <div class="flex items-start gap-2">
            <AlertCircle class="mt-0.5 shrink-0 text-primary" size={20} />
            <div>
              <p class="font-semibold text-primary">
                Save the Hardware Secret for {form.hardwareId} now!
              </p>
              <p class="text-sm text-muted-foreground">
                You won't be able to see it again. Copy it onto the Randomizer
                Box; if it is lost, rotate the Hardware Secret.
              </p>
            </div>
          </div>
          <div class="flex gap-2">
            <code
              class="flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm"
              data-testid="hardware-secret"
            >
              {secret}
            </code>
            <Button
              variant="outline"
              size="sm"
              aria-label="Copy Hardware Secret"
              onclick={() => copySecret(secret)}
            >
              {#if copied}
                <Check size={16} />
              {:else}
                <Copy size={16} />
              {/if}
            </Button>
          </div>
        </div>
      {:else if form?.success}
        <Alert variant="success">{form.message}</Alert>
      {:else if form?.success === false}
        <Alert variant="destructive">{form.message}</Alert>
      {/if}

      {#if showRegister}
        <form
          method="POST"
          action="?/registerHardware"
          use:enhance={() => {
            return async ({ update, result }) => {
              await update();
              if (result.type === 'success') showRegister = false;
            };
          }}
          class="flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-end"
        >
          <div class="flex-1 space-y-2">
            <Label for="hardwareId">Hardware ID</Label>
            <Input
              id="hardwareId"
              name="hardwareId"
              required
              maxlength={64}
              placeholder="AA:BB:CC:DD:EE:FF"
              class="font-mono"
            />
          </div>
          <Button type="submit">Register</Button>
        </form>
      {/if}

      {#if data.hardware.length === 0}
        <p class="py-4 text-center text-sm text-muted-foreground">
          No Hardware registered yet.
        </p>
      {:else}
        <div class="space-y-2">
          {#each data.hardware as hardware (hardware.id)}
            <div
              class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              class:opacity-60={hardware.revokedAt}
              data-testid="hardware-row"
            >
              <div class="flex items-center gap-3">
                <Cpu class="h-4 w-4 text-muted-foreground" />
                <div>
                  <div class="font-mono text-sm">{hardware.hardwareId}</div>
                  <div class="text-xs text-muted-foreground">
                    {#if hardware.revokedAt}
                      Revoked {formatDateTime(hardware.revokedAt)}
                    {:else if hasCheckedIn(hardware.lastSeenAt)}
                      LAN IP: {hardware.localIpAddress} · Last seen {formatDateTime(
                        hardware.lastSeenAt
                      )}
                    {:else}
                      Never checked in
                    {/if}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                {#if hardware.revokedAt}
                  <Badge variant="destructive">Revoked</Badge>
                {:else}
                  <Badge variant={hardware.isOnline ? 'default' : 'outline'}>
                    {hardware.isOnline ? 'Online' : 'Offline'}
                  </Badge>
                  <form
                    method="POST"
                    action="?/rotateHardwareSecret"
                    use:enhance
                  >
                    <input type="hidden" name="id" value={hardware.id} />
                    <input
                      type="hidden"
                      name="hardwareId"
                      value={hardware.hardwareId}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      onclick={(event) => {
                        if (
                          !confirm(
                            `Rotate the Hardware Secret for ${hardware.hardwareId}? The current secret stops working immediately.`
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <KeyRound class="mr-1 h-3.5 w-3.5" />
                      Rotate secret
                    </Button>
                  </form>
                  <form method="POST" action="?/revokeHardware" use:enhance>
                    <input type="hidden" name="id" value={hardware.id} />
                    <input
                      type="hidden"
                      name="hardwareId"
                      value={hardware.hardwareId}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      class="text-destructive hover:text-destructive"
                      onclick={(event) => {
                        if (
                          !confirm(
                            `Revoke ${hardware.hardwareId}? It will permanently stop authenticating. This cannot be undone.`
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <Ban class="mr-1 h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </form>
                {/if}
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
