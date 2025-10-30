<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import LoadingOverlay from '$lib/components/loading-overlay.svelte';
  import { MatchCard } from '$lib/components/match-card';
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { isPresent } from '$lib/util/isPresent';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import {
    superForm,
    type Infer,
    type SuperValidated,
  } from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import type { UserDetails } from '../../../../api';
  import type { MatchSchema } from '../match-schema';
  import { matchSchema } from '../match-schema';
  import TeamMemberField from './team-member-field.svelte';

  interface Props {
    initialData: SuperValidated<Infer<MatchSchema>>;
    users: UserDetails[];
  }

  let { initialData, users }: Props = $props();

  const PLAYER_1_LOCAL_STORAGE_KEY = 'player1Id';
  const LATEST_PLAYERS_LOCAL_STORAGE_KEY = 'latestPlayers';

  const localLatestStoragePlayers = browser
    ? window.localStorage.getItem(LATEST_PLAYERS_LOCAL_STORAGE_KEY)?.split(',')
    : null;

  const latestPlayerIds =
    localLatestStoragePlayers?.map((playerId) => parseInt(playerId)) ?? [];

  const localPlayer1IdString = browser
    ? window.localStorage.getItem(PLAYER_1_LOCAL_STORAGE_KEY)
    : null;

  const localPlayer1Id = localPlayer1IdString
    ? parseInt(localPlayer1IdString)
    : null;

  const player1Id =
    localPlayer1Id != null && !isNaN(localPlayer1Id) ? localPlayer1Id : null;

  const form = superForm(initialData, {
    validators: zodClient(matchSchema),
    dataType: 'json',
    delayMs: 500,
    onSubmit: (data) => {
      const enteredPlayer1 = data.formData.get('team1.member1');
      const enteredPlayerIds = [
        enteredPlayer1,
        data.formData.get('team1.member2'),
        data.formData.get('team2.member1'),
        data.formData.get('team2.member2'),
      ]
        .filter(isPresent)
        .map((id) => {
          if (typeof id === 'string') {
            const parsedInt = parseInt(id);
            return isNaN(parsedInt) ? null : parsedInt;
          }
          return null;
        })
        .filter(isPresent);

      const newLatestPlayerIds = [
        ...enteredPlayerIds,
        ...latestPlayerIds.filter((id) => !enteredPlayerIds.includes(id)),
      ].slice(0, 10);
      if (browser) {
        if (enteredPlayer1 != null && typeof enteredPlayer1 === 'string') {
          window.localStorage.setItem(
            PLAYER_1_LOCAL_STORAGE_KEY,
            enteredPlayer1
          );
        }
        window.localStorage.setItem(
          LATEST_PLAYERS_LOCAL_STORAGE_KEY,
          newLatestPlayerIds.join(',')
        );
      }
    },
  });

  const { form: formData, enhance, submitting, message } = form;

  onMount(() => {
    $formData.team1.member1 = player1Id ?? $formData.team1.member1;
  });

  let loosingTeam: 'team1' | 'team2' | null = $derived(
    $formData.team1.score === 10
      ? 'team2'
      : $formData.team2.score === 10
        ? 'team1'
        : null
  );

  const setTeam1AsWinner = () => {
    $formData.team1.score = 10;
    $formData.team2.score = -1;
    goto('#score-step');
  };
  const setTeam2AsWinner = () => {
    $formData.team2.score = 10;
    $formData.team1.score = -1;
    goto('#score-step');
  };

  let isMatchCardVisible = $derived(
    loosingTeam !== null &&
      $formData.team1.score !== -1 &&
      $formData.team2.score !== -1
  );

  let allInitialsFilled = $derived(
    $formData.team1.member1 !== -1 &&
      $formData.team1.member2 !== -1 &&
      $formData.team2.member1 !== -1 &&
      $formData.team2.member2 !== -1
  );

  let filledTeam1 = $derived(
    $formData.team1.member1 !== -1 && $formData.team1.member2 !== -1
  );

  let currentMatchUsers = $derived([
    $formData.team1.member1,
    $formData.team1.member2,
    $formData.team2.member1,
    $formData.team2.member2,
  ]);

  let availableUsers = $derived(
    users.filter((user) => !currentMatchUsers.includes(user.userId))
  );

  let onCreateUser = $derived((suggested: string, inputName: string) => {
    const redirectToParams = [
      $formData.team1.member1 !== -1
        ? `player1_id=${$formData.team1.member1}`
        : null,
      $formData.team1.member2 !== -1
        ? `player2_id=${$formData.team1.member2}`
        : null,
      $formData.team2.member1 !== -1
        ? `player3_id=${$formData.team2.member1}`
        : null,
      $formData.team2.member2 !== -1
        ? `player4_id=${$formData.team2.member2}`
        : null,
    ]
      .filter(isPresent)
      .join('&');
    const redirectTo = `/submit?${redirectToParams}&${inputName}=`;
    const nameParam = suggested !== '' ? `&name=${suggested}` : '';
    goto(
      `/new-player?redirect_to=${encodeURIComponent(redirectTo)}${nameParam}`
    );
  });
</script>

<form method="post" use:enhance>
  <div class="flex flex-col gap-2">
    <input
      type="hidden"
      name="team1.member1"
      bind:value={$formData.team1.member1}
    />
    <input
      type="hidden"
      name="team1.member2"
      bind:value={$formData.team1.member2}
    />
    <input
      type="hidden"
      name="team2.member1"
      bind:value={$formData.team2.member1}
    />
    <input
      type="hidden"
      name="team2.member2"
      bind:value={$formData.team2.member2}
    />
    <div class="flex gap-3">
      <div id="team1-step" class="flex flex-1 flex-col gap-4">
        <h3 class="mb-2 text-center text-2xl">Team 1</h3>
        <TeamMemberField
          bind:userId={$formData.team1.member1}
          label="You"
          {users}
          {availableUsers}
          {latestPlayerIds}
          onCreateUser={(suggested) => onCreateUser(suggested, 'player1_id')}
        />
        {#if $formData.team1.member1 !== -1 || $formData.team1.member2 !== -1}
          <TeamMemberField
            bind:userId={$formData.team1.member2}
            label="Your teammate"
            {users}
            {availableUsers}
            {latestPlayerIds}
            onCreateUser={(suggested) => onCreateUser(suggested, 'player2_id')}
          />
        {/if}
      </div>
      <div class="flex-s bg-border min-h-full w-px"></div>
      <div id="team2-step" class="flex flex-1 flex-col gap-4">
        <h3 class="mb-2 text-center text-2xl">Team 2</h3>
        {#if filledTeam1 || $formData.team2.member1 !== -1}
          <TeamMemberField
            bind:userId={$formData.team2.member1}
            label="Opponent 1"
            {users}
            {availableUsers}
            {latestPlayerIds}
            onCreateUser={(suggested) => onCreateUser(suggested, 'player3_id')}
          />
        {/if}
        {#if $formData.team2.member1 !== -1 || $formData.team2.member2 !== -1}
          <TeamMemberField
            bind:userId={$formData.team2.member2}
            label="Opponent 2"
            {users}
            {availableUsers}
            {latestPlayerIds}
            onCreateUser={(suggested) => onCreateUser(suggested, 'player4_id')}
          />
        {/if}
      </div>
    </div>
    {#if allInitialsFilled}
      <div id="winner-step" class="flex flex-col gap-4" transition:fade>
        <h2 class="text-center text-4xl">Who won?</h2>
        <div class="flex flex-row gap-4">
          <Button
            type="button"
            onclick={setTeam1AsWinner}
            class="flex-1"
            variant="default"
            disabled={$formData.team1.score === 10}>We won &nbsp; 🎉</Button
          >
          <div class="flex-s bg-border min-h-full w-px"></div>
          <Button
            type="button"
            onclick={setTeam2AsWinner}
            class="flex-1"
            variant="destructive"
            disabled={$formData.team2.score === 10}>They won &nbsp; 😓</Button
          >
        </div>
      </div>
    {/if}
    {#if loosingTeam}
      <div id="score-step" class="flex flex-col gap-4" transition:fade>
        <h2 class="text-center text-4xl">
          What was {loosingTeam === 'team1' ? 'your' : 'their'} score?
        </h2>
        <div class="grid grid-cols-5 gap-2">
          {#each Array.from({ length: 10 }, (_, i) => i) as score}
            <Button
              type="button"
              variant={$formData[loosingTeam].score === score
                ? 'default'
                : 'outline'}
              onclick={() => {
                $formData[loosingTeam].score = score;
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
        <MatchCard match={{ ...$formData, matchId: 0 }} {users} showMmr={false} />
        <Form.Button>Submit the match</Form.Button>
      </div>
    {/if}
    {#if $message}
      <p class="text-red-500">{$message}</p>
    {/if}
  </div>
</form>

<LoadingOverlay isLoading={$submitting} message="Uploading match result" />
