<script lang="ts">
  import type { ActiveMatchDto, UserDetails } from '$api';
  import { goto } from '$app/navigation';
  import LoadingOverlay from '$lib/components/loading-overlay.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { fade } from 'svelte/transition';
  import {
    superForm,
    type Infer,
    type SuperValidated,
  } from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import ActiveMatchCard from '../../../components/active-match-card.svelte';
  import type { ActiveMatchSubmitSchema } from '../active-match-submit-schema';
  import { activeMatchSubmitSchema } from '../active-match-submit-schema';

  interface Props {
    data: SuperValidated<Infer<ActiveMatchSubmitSchema>>;
    activeMatch: ActiveMatchDto;
    users: UserDetails[];
    currentPlayerId: number;
  }

  let { data, activeMatch, users, currentPlayerId }: Props = $props();

  type TeamOption = 'team1' | 'team2';

  let currentUserTeam: TeamOption | null = activeMatch.team1.playerIds.includes(
    currentPlayerId
  )
    ? 'team1'
    : activeMatch.team2.playerIds.includes(currentPlayerId)
      ? 'team2'
      : null;

  if (currentUserTeam === null) {
    throw new Error('Current player is not in the active match');
  }

  const otherTeam: TeamOption = currentUserTeam === 'team1' ? 'team2' : 'team1';

  const currentUserTeamPlayers = [
    currentPlayerId,
    ...activeMatch[currentUserTeam].playerIds.filter(
      (id) => id !== currentPlayerId
    ),
  ];

  const otherTeamPlayers = activeMatch[otherTeam].playerIds;

  const tweakedActiveMatch: ActiveMatchDto = {
    ...activeMatch,
    team1: {
      ...activeMatch[currentUserTeam],
      playerIds: currentUserTeamPlayers,
    },
    team2: { ...activeMatch[otherTeam], playerIds: otherTeamPlayers },
  };

  const form = superForm(data, {
    validators: zodClient(activeMatchSubmitSchema),
    dataType: 'json',
    delayMs: 500,
  });

  const { form: formData, enhance, submitting, message } = form;

  let loosingTeam: TeamOption | null = $derived(
    $formData.team1Score === 10
      ? 'team2'
      : $formData.team2Score === 10
        ? 'team1'
        : null
  );

  const setTeamAsWinner = (winningTeam: TeamOption) => {
    let losingTeam: TeamOption = winningTeam === 'team1' ? 'team2' : 'team1';
    $formData[`${winningTeam}Score`] = 10;
    $formData[`${losingTeam}Score`] = -1;
    goto('#score-step');
  };

  let isMatchCardVisible = $derived(
    loosingTeam !== null &&
      $formData.team1Score !== -1 &&
      $formData.team2Score !== -1
  );
</script>

<form method="post" use:enhance>
  <div class="flex flex-col gap-2">
    <div class="flex gap-3">
      <div id="team1-step" class="flex flex-1 flex-col gap-4">
        <h3 class="mb-2 text-center text-2xl">Team 1</h3>
        {#each tweakedActiveMatch.team1.playerIds as playerId}
          {@const user = users.find((user) => user.userId === playerId)}
          <p
            class="space-x-1"
            class:text-primary={user?.userId === currentPlayerId}
          >
            {user?.name}
          </p>
        {/each}
      </div>
      <div class="flex-s bg-border min-h-full w-px"></div>
      <div id="team2-step" class="flex flex-1 flex-col gap-4">
        <h3 class="mb-2 text-center text-2xl">Team 2</h3>
        {#each tweakedActiveMatch.team2.playerIds as playerId}
          {@const user = users.find((user) => user.userId === playerId)}
          <p
            class="space-x-1"
            class:text-primary={user?.userId === currentPlayerId}
          >
            {user?.name}
          </p>
        {/each}
      </div>
    </div>
    <div id="winner-step" class="flex flex-col gap-4" transition:fade>
      <h2 class="text-center text-4xl">Who won?</h2>
      <div class="flex flex-row gap-4">
        <Button
          type="button"
          onclick={() => setTeamAsWinner(currentUserTeam)}
          class="flex-1"
          variant="default"
          disabled={$formData[`${currentUserTeam}Score`] === 10}
          >We won &nbsp; 🎉</Button
        >
        <div class="flex-s bg-border min-h-full w-px"></div>
        <Button
          type="button"
          onclick={() => setTeamAsWinner(otherTeam)}
          class="flex-1"
          variant="destructive"
          disabled={$formData[`${otherTeam}Score`] === 10}
          >They won &nbsp; 😓</Button
        >
      </div>
    </div>
    {#if loosingTeam}
      <div id="score-step" class="flex flex-col gap-4" transition:fade>
        <h2 class="text-center text-4xl">
          What was {loosingTeam === currentUserTeam ? 'your' : 'their'} score?
        </h2>
        <div class="grid grid-cols-5 gap-2">
          {#each Array.from({ length: 10 }, (_, i) => i) as score}
            <Button
              type="button"
              variant={$formData[`${loosingTeam}Score`] === score
                ? 'default'
                : 'outline'}
              onclick={() => {
                $formData[`${loosingTeam}Score`] = score;
                goto('#submit-step');
              }}
            >
              {score === 0 ? '🥚' : score}
            </Button>
          {/each}
        </div>
      </div>
    {/if}
    {#if isMatchCardVisible}
      <div id="submit-step" class="flex flex-col gap-4" transition:fade>
        <h2 class="text-center text-4xl">Submit?</h2>
        <ActiveMatchCard
          match={tweakedActiveMatch}
          {users}
          team1Score={$formData[`${currentUserTeam}Score`]}
          team2Score={$formData[`${otherTeam}Score`]}
        />
        <Form.Button>Submit the match</Form.Button>
      </div>
    {/if}
    {#if $message}
      <p class="text-red-500">{$message}</p>
    {/if}
  </div>
</form>

<LoadingOverlay isLoading={$submitting} message="Uploading match result" />
