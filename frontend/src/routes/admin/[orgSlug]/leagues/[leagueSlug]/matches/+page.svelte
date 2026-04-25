<script lang="ts">
  import { enhance } from '$app/forms';
  import EditMatchDialog from '$lib/components/admin/edit-match-dialog.svelte';
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
  import * as Table from '$lib/components/ui/table';
  import {
    ChevronLeft,
    ChevronRight,
    Pencil,
    RefreshCw,
    Trash2,
  } from 'lucide-svelte';
  import type { MatchResponse } from '$api3';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  function formatDateTime(d: string): string {
    return new Date(d).toLocaleString();
  }

  function teamPlayers(
    players: { displayName?: string; username?: string }[]
  ): string {
    return players.map((p) => p.displayName ?? p.username ?? '?').join(' & ');
  }

  const prevOffset = $derived(Math.max(0, data.offset - data.pageSize));
  const nextOffset = $derived(data.offset + data.pageSize);

  let editing = $state<MatchResponse | null>(null);
  let editDialogOpen = $state(false);

  function openEdit(match: MatchResponse) {
    editing = match;
    editDialogOpen = true;
  }
</script>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 class="text-xl font-semibold">Matches</h2>
      <p class="text-sm text-muted-foreground">
        Edit, delete, and recalculate MMR for matches in the current season.
        Edits leave rating history untouched — recalc to flow through to the
        leaderboard.
      </p>
    </div>
    <form method="POST" action="?/recalculate" use:enhance>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        onclick={(event) => {
          if (!confirm('Replay every match in the current season?')) {
            event.preventDefault();
          }
        }}
      >
        <RefreshCw class="mr-2 h-4 w-4" />
        Recalculate season
      </Button>
    </form>
  </div>

  {#if form?.success}
    <Alert variant="success">{form.message}</Alert>
  {:else if form?.success === false}
    <Alert variant="destructive">{form.message}</Alert>
  {/if}

  <Card>
    <CardHeader>
      <CardTitle>Recent matches</CardTitle>
      <CardDescription>
        Showing {data.matches.length} from offset {data.offset}
      </CardDescription>
    </CardHeader>
    <CardContent>
      {#if data.matches.length === 0}
        <p class="py-6 text-center text-sm text-muted-foreground">
          No matches at this offset.
        </p>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Played</Table.Head>
              <Table.Head>Team 1</Table.Head>
              <Table.Head class="text-center">Score</Table.Head>
              <Table.Head>Team 2</Table.Head>
              <Table.Head class="text-right">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.matches as match (match.id)}
              {@const team1 = match.teams[0]}
              {@const team2 = match.teams[1]}
              {@const isLatest = match.id === data.latestMatchId}
              <Table.Row data-testid="admin-match-row" data-match-id={match.id}>
                <Table.Cell class="whitespace-nowrap text-sm">
                  {formatDateTime(match.playedAt)}
                </Table.Cell>
                <Table.Cell class={team1?.isWinner ? 'font-semibold' : ''}>
                  {teamPlayers(team1?.players ?? [])}
                </Table.Cell>
                <Table.Cell class="text-center font-mono text-sm">
                  {team1?.score} – {team2?.score}
                </Table.Cell>
                <Table.Cell class={team2?.isWinner ? 'font-semibold' : ''}>
                  {teamPlayers(team2?.players ?? [])}
                </Table.Cell>
                <Table.Cell class="text-right">
                  <div class="flex flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onclick={() => openEdit(match)}
                      data-testid="admin-match-edit"
                    >
                      <Pencil class="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <form
                      method="POST"
                      action="?/recalculate"
                      use:enhance
                      class="inline-block"
                    >
                      <input
                        type="hidden"
                        name="fromMatchId"
                        value={match.id}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        data-testid="admin-match-recalculate"
                      >
                        <RefreshCw class="mr-1 h-3.5 w-3.5" />
                        Recalc
                      </Button>
                    </form>
                    <form
                      method="POST"
                      action="?/delete"
                      use:enhance
                      class="inline-block"
                    >
                      <input type="hidden" name="matchId" value={match.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        class="text-destructive hover:text-destructive"
                        data-testid="admin-match-delete"
                        onclick={(event) => {
                          const msg = isLatest
                            ? 'Delete this match and roll back its rating impact?'
                            : 'Delete this match? Ratings for downstream matches will be wrong until you recalculate.';
                          if (!confirm(msg)) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <Trash2 class="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </form>
                    {#if isLatest}
                      <Badge variant="outline" class="text-xs">Latest</Badge>
                    {/if}
                  </div>
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </CardContent>
  </Card>

  <div class="flex items-center justify-between">
    <Button
      variant="outline"
      size="sm"
      href={data.offset === 0 ? '#' : `?offset=${prevOffset}`}
      disabled={data.offset === 0}
    >
      <ChevronLeft class="mr-1 h-4 w-4" />
      Newer
    </Button>
    <Button
      variant="outline"
      size="sm"
      href={data.hasMore ? `?offset=${nextOffset}` : '#'}
      disabled={!data.hasMore}
    >
      Older
      <ChevronRight class="ml-1 h-4 w-4" />
    </Button>
  </div>
</div>

<EditMatchDialog
  open={editDialogOpen}
  onOpenChange={(value) => (editDialogOpen = value)}
  match={editing}
  leaguePlayers={data.leaguePlayers}
/>
