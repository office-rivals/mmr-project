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
  import * as Table from '$lib/components/ui/table';
  import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-svelte';
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
</script>

<div class="space-y-4">
  <div>
    <h2 class="text-xl font-semibold">Matches</h2>
    <p class="text-sm text-muted-foreground">
      Most recent matches in this league. Only the latest match can be deleted —
      that action rolls back ratings safely. To correct any earlier match, ask a
      player to flag it instead.
    </p>
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
              <Table.Row>
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
                  {#if isLatest}
                    <form
                      method="POST"
                      action="?/delete"
                      use:enhance
                      class="inline-block"
                    >
                      <input type="hidden" name="matchId" value={match.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        class="text-destructive hover:text-destructive"
                        onclick={(event) => {
                          if (
                            !confirm(
                              'Delete this match and roll back its rating impact?'
                            )
                          ) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <Trash2 class="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </form>
                  {:else}
                    <Badge variant="outline" class="text-xs">Locked</Badge>
                  {/if}
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
