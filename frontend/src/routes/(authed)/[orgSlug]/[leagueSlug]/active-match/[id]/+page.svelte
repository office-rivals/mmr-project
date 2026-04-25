<script lang="ts">
  import { goto } from '$app/navigation';
  import LoadingOverlay from '$lib/components/loading-overlay.svelte';
  import PageTitle from '$lib/components/page-title.svelte';
  import { Alert } from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { fade } from 'svelte/transition';
  import type { ActionData, PageData } from './$types';

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  type TeamOption = 'team1' | 'team2';

  const teams = $derived(
    [...(data.activeMatch?.teams ?? [])].sort((a, b) => a.index - b.index)
  );

  const playerInTeam = (
    teamIndex: number,
    leaguePlayerId: string | null | undefined
  ) =>
    leaguePlayerId
      ? teams[teamIndex]?.players.some(
          (p) => p.leaguePlayerId === leaguePlayerId
        ) ?? false
      : false;

  const currentUserTeam: TeamOption = $derived(
    playerInTeam(0, data.currentLeaguePlayerId)
      ? 'team1'
      : playerInTeam(1, data.currentLeaguePlayerId)
        ? 'team2'
        : 'team1'
  );

  const otherTeam: TeamOption = $derived(
    currentUserTeam === 'team1' ? 'team2' : 'team1'
  );

  const teamPlayers = (which: TeamOption) =>
    which === 'team1' ? teams[0]?.players ?? [] : teams[1]?.players ?? [];

  // Reorder so the current player appears first within their team for clarity
  const orderedPlayers = (which: TeamOption) => {
    const players = teamPlayers(which);
    if (which !== currentUserTeam) return players;
    const me = players.find(
      (p) => p.leaguePlayerId === data.currentLeaguePlayerId
    );
    if (!me) return players;
    return [me, ...players.filter((p) => p !== me)];
  };

  let team1Score = $state(-1);
  let team2Score = $state(-1);
  let submitting = $state(false);

  let losingTeam: TeamOption | null = $derived(
    team1Score === 10 ? 'team2' : team2Score === 10 ? 'team1' : null
  );

  let isPreviewVisible = $derived(
    losingTeam !== null && team1Score !== -1 && team2Score !== -1
  );

  function setWinner(which: TeamOption) {
    if (which === 'team1') {
      team1Score = 10;
      team2Score = -1;
    } else {
      team2Score = 10;
      team1Score = -1;
    }
    goto('#score-step');
  }

  function setLoserScore(score: number) {
    if (losingTeam === 'team1') team1Score = score;
    else if (losingTeam === 'team2') team2Score = score;
    goto('#submit-step');
  }

  // Map our currentUserTeam first to "We won" buttons (visual order swapped)
  // but the wire format stays index-based: team1Score → teams[0], team2Score → teams[1].

  const orderForUi: [TeamOption, TeamOption] = $derived(
    currentUserTeam === 'team1'
      ? ['team1', 'team2']
      : ['team2', 'team1']
  );

  function teamHeading(which: TeamOption): string {
    return which === currentUserTeam ? 'Your team' : 'Opponents';
  }
</script>

<div class="flex flex-col gap-8">
  <PageTitle>Submit match result</PageTitle>

  {#if form?.message}
    <Alert variant="destructive">{form.message}</Alert>
  {/if}

  <form
    method="post"
    onsubmit={() => (submitting = true)}
    class="flex flex-col gap-2"
  >
    <input type="hidden" name="orgId" value={data.orgId} />
    <input type="hidden" name="leagueId" value={data.leagueId} />
    <input type="hidden" name="team1_score" value={team1Score} />
    <input type="hidden" name="team2_score" value={team2Score} />

    <div class="flex gap-3">
      {#each orderForUi as which (which)}
        <div class="flex flex-1 flex-col gap-2">
          <h3 class="mb-2 text-center text-2xl">{teamHeading(which)}</h3>
          {#each orderedPlayers(which) as player (player.leaguePlayerId)}
            <p
              class="text-center"
              class:text-primary={player.leaguePlayerId ===
                data.currentLeaguePlayerId}
            >
              {player.displayName ?? player.username ?? 'Unknown'}
            </p>
          {/each}
        </div>
      {/each}
    </div>

    <div id="winner-step" class="mt-6 flex flex-col gap-4" transition:fade>
      <h2 class="text-center text-4xl">Who won?</h2>
      <div class="flex flex-row gap-4">
        <Button
          type="button"
          onclick={() => setWinner(currentUserTeam)}
          class="flex-1"
          variant="default"
          disabled={(currentUserTeam === 'team1' ? team1Score : team2Score) ===
            10}
        >
          We won &nbsp; 🎉
        </Button>
        <div class="bg-border min-h-full w-px"></div>
        <Button
          type="button"
          onclick={() => setWinner(otherTeam)}
          class="flex-1"
          variant="destructive"
          disabled={(otherTeam === 'team1' ? team1Score : team2Score) === 10}
        >
          They won &nbsp; 😓
        </Button>
      </div>
    </div>

    {#if losingTeam}
      <div id="score-step" class="mt-6 flex flex-col gap-4" transition:fade>
        <h2 class="text-center text-4xl">
          What was {losingTeam === currentUserTeam ? 'your' : 'their'} score?
        </h2>
        <div class="grid grid-cols-5 gap-2">
          {#each Array.from({ length: 10 }, (_, i) => i) as score}
            <Button
              type="button"
              variant={(losingTeam === 'team1' ? team1Score : team2Score) ===
              score
                ? 'default'
                : 'outline'}
              onclick={() => setLoserScore(score)}
            >
              {score === 0 ? '🥚' : score}
            </Button>
          {/each}
        </div>
      </div>
    {/if}

    {#if isPreviewVisible}
      <div id="submit-step" class="mt-6 flex flex-col gap-4" transition:fade>
        <h2 class="text-center text-4xl">Submit?</h2>
        <div class="text-center text-2xl">
          {teamHeading(currentUserTeam)}: {currentUserTeam === 'team1'
            ? team1Score
            : team2Score}
          &nbsp;–&nbsp;
          {otherTeam === 'team1' ? team1Score : team2Score} :
          {teamHeading(otherTeam)}
        </div>
        <Button type="submit">Submit the match</Button>
      </div>
    {/if}
  </form>
</div>

<LoadingOverlay isLoading={submitting} message="Uploading match result" />
