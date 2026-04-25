<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import LoadingOverlay from '$lib/components/loading-overlay.svelte';
  import MatchCard from '$lib/components/match-card/match-card.svelte';
  import PageTitle from '$lib/components/page-title.svelte';
  import { MatchSource, type MatchResponse } from '$api3';
  import { Alert } from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { fade } from 'svelte/transition';
  import type { ActionData, PageData } from './$types';
  import TeamMemberField, {
    type SlotValue,
  } from './components/team-member-field.svelte';

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  let { data, form }: Props = $props();

  type SlotName =
    | 'team1_player1'
    | 'team1_player2'
    | 'team2_player1'
    | 'team2_player2';

  const SLOTS: SlotName[] = [
    'team1_player1',
    'team1_player2',
    'team2_player1',
    'team2_player2',
  ];

  const PRIMARY_PLAYER_KEY = 'primaryLeaguePlayerId';
  const LATEST_PLAYERS_KEY = 'latestLeaguePlayerIds';

  let slots = $state<Record<SlotName, SlotValue>>({
    team1_player1: null,
    team1_player2: null,
    team2_player1: null,
    team2_player2: null,
  });

  // Hydrate primary player from localStorage on mount
  $effect(() => {
    if (!browser) return;
    const primaryId = window.localStorage.getItem(PRIMARY_PLAYER_KEY);
    if (primaryId && slots.team1_player1 === null) {
      const player = data.players.find((p) => p.id === primaryId);
      if (player) slots.team1_player1 = { kind: 'league', player };
    }
  });

  let latestPlayerIds = $state<string[]>([]);
  $effect(() => {
    if (!browser) return;
    const stored = window.localStorage.getItem(LATEST_PLAYERS_KEY);
    if (stored) latestPlayerIds = stored.split(',').filter(Boolean);
  });

  let team1Score = $state(-1);
  let team2Score = $state(-1);

  let dialogOpen = $state(false);
  let dialogSlot = $state<SlotName>('team1_player1');
  let dialogDisplayName = $state('');
  let dialogEmail = $state('');
  let dialogError = $state('');

  let submitting = $state(false);

  function openNewPlayerDialog(slot: SlotName, suggested: string) {
    dialogSlot = slot;
    dialogDisplayName = suggested;
    dialogEmail = '';
    dialogError = '';
    dialogOpen = true;
  }

  function saveNewPlayer() {
    if (dialogDisplayName.trim() === '') {
      dialogError = 'Display name is required';
      return;
    }
    slots[dialogSlot] = {
      kind: 'new',
      displayName: dialogDisplayName.trim(),
      email: dialogEmail.trim(),
    };
    dialogOpen = false;
  }

  function slotToFormValue(value: SlotValue): string {
    if (value === null) return '';
    if (value.kind === 'league') return `league:${value.player.id}`;
    if (value.kind === 'member') return `member:${value.member.id}`;
    return 'new';
  }

  function slotExclusion(value: SlotValue): string | null {
    if (value === null) return null;
    if (value.kind === 'league') return `league:${value.player.id}`;
    if (value.kind === 'member') return `member:${value.member.id}`;
    return null;
  }

  let allFilled = $derived(SLOTS.every((s) => slots[s] !== null));
  let team1Filled = $derived(
    slots.team1_player1 !== null && slots.team1_player2 !== null
  );

  let exclusions = $derived(
    SLOTS.map((s) => slotExclusion(slots[s])).filter((v): v is string => !!v)
  );

  let losingTeam: 'team1' | 'team2' | null = $derived(
    team1Score === 10 ? 'team2' : team2Score === 10 ? 'team1' : null
  );

  let isPreviewVisible = $derived(
    losingTeam !== null && team1Score !== -1 && team2Score !== -1
  );

  function setTeam1Wins() {
    team1Score = 10;
    team2Score = -1;
    goto('#score-step');
  }

  function setTeam2Wins() {
    team2Score = 10;
    team1Score = -1;
    goto('#score-step');
  }

  function previewMatch(): MatchResponse {
    const playerName = (slot: SlotValue) => {
      if (slot === null) return 'Unknown';
      if (slot.kind === 'league')
        return slot.player.displayName ?? slot.player.username ?? 'Unknown';
      if (slot.kind === 'member')
        return slot.member.displayName ?? slot.member.username ?? 'Unknown';
      return slot.displayName;
    };

    return {
      id: 'preview',
      leagueId: data.leagueId,
      seasonId: '',
      source: MatchSource.Manual,
      playedAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      teams: [
        {
          id: 't1',
          index: 0,
          score: team1Score === -1 ? 0 : team1Score,
          isWinner: team1Score === 10,
          players: [slots.team1_player1, slots.team1_player2].map((s, i) => ({
            id: `t1p${i}`,
            leaguePlayerId: '',
            displayName: playerName(s),
            index: i,
          })),
        },
        {
          id: 't2',
          index: 1,
          score: team2Score === -1 ? 0 : team2Score,
          isWinner: team2Score === 10,
          players: [slots.team2_player1, slots.team2_player2].map((s, i) => ({
            id: `t2p${i}`,
            leaguePlayerId: '',
            displayName: playerName(s),
            index: i,
          })),
        },
      ],
    };
  }

  // Persist primary + latest on submit
  function onBeforeSubmit() {
    if (!browser) return;
    const enteredIds = SLOTS.map((s) => {
      const v = slots[s];
      return v?.kind === 'league' ? v.player.id : null;
    }).filter((v): v is string => !!v);

    if (enteredIds[0]) {
      window.localStorage.setItem(PRIMARY_PLAYER_KEY, enteredIds[0]);
    }
    const merged = [
      ...enteredIds,
      ...latestPlayerIds.filter((id) => !enteredIds.includes(id)),
    ].slice(0, 10);
    window.localStorage.setItem(LATEST_PLAYERS_KEY, merged.join(','));
  }
</script>

<div class="flex flex-col gap-8">
  <PageTitle>Submit match</PageTitle>

  {#if form?.message}
    <Alert variant="destructive">{form.message}</Alert>
  {/if}

  <form
    method="post"
    onsubmit={() => {
      onBeforeSubmit();
      submitting = true;
    }}
  >
    <input type="hidden" name="orgId" value={data.orgId} />
    <input type="hidden" name="leagueId" value={data.leagueId} />
    {#each SLOTS as slot}
      <input type="hidden" name={slot} value={slotToFormValue(slots[slot])} />
      {#if slots[slot]?.kind === 'new'}
        <input
          type="hidden"
          name="{slot}_displayName"
          value={slots[slot].displayName}
        />
        <input type="hidden" name="{slot}_email" value={slots[slot].email} />
      {/if}
    {/each}
    <input type="hidden" name="team1_score" value={team1Score} />
    <input type="hidden" name="team2_score" value={team2Score} />

    <div class="flex flex-col gap-2">
      <div class="flex gap-3">
        <div id="team1-step" class="flex flex-1 flex-col gap-4">
          <h3 class="mb-2 text-center text-2xl">Team 1</h3>
          <TeamMemberField
            label="You"
            value={slots.team1_player1}
            onChange={(v) => (slots.team1_player1 = v)}
            leaguePlayers={data.players}
            orgMembers={data.members}
            {latestPlayerIds}
            excludeIds={exclusions}
            onCreateUser={(suggested) =>
              openNewPlayerDialog('team1_player1', suggested)}
            autofocus
          />
          {#if slots.team1_player1 !== null || slots.team1_player2 !== null}
            <TeamMemberField
              label="Your teammate"
              value={slots.team1_player2}
              onChange={(v) => (slots.team1_player2 = v)}
              leaguePlayers={data.players}
              orgMembers={data.members}
              {latestPlayerIds}
              excludeIds={exclusions}
              onCreateUser={(suggested) =>
                openNewPlayerDialog('team1_player2', suggested)}
            />
          {/if}
        </div>
        <div class="min-h-full w-px bg-border"></div>
        <div id="team2-step" class="flex flex-1 flex-col gap-4">
          <h3 class="mb-2 text-center text-2xl">Team 2</h3>
          {#if team1Filled || slots.team2_player1 !== null}
            <TeamMemberField
              label="Opponent 1"
              value={slots.team2_player1}
              onChange={(v) => (slots.team2_player1 = v)}
              leaguePlayers={data.players}
              orgMembers={data.members}
              {latestPlayerIds}
              excludeIds={exclusions}
              onCreateUser={(suggested) =>
                openNewPlayerDialog('team2_player1', suggested)}
            />
          {/if}
          {#if slots.team2_player1 !== null || slots.team2_player2 !== null}
            <TeamMemberField
              label="Opponent 2"
              value={slots.team2_player2}
              onChange={(v) => (slots.team2_player2 = v)}
              leaguePlayers={data.players}
              orgMembers={data.members}
              {latestPlayerIds}
              excludeIds={exclusions}
              onCreateUser={(suggested) =>
                openNewPlayerDialog('team2_player2', suggested)}
            />
          {/if}
        </div>
      </div>

      {#if allFilled}
        <div id="winner-step" class="mt-6 flex flex-col gap-4" transition:fade>
          <h2 class="text-center text-4xl">Who won?</h2>
          <div class="flex flex-row gap-4">
            <Button
              type="button"
              onclick={setTeam1Wins}
              class="flex-1"
              variant="default"
              disabled={team1Score === 10}
            >
              We won &nbsp; 🎉
            </Button>
            <div class="min-h-full w-px bg-border"></div>
            <Button
              type="button"
              onclick={setTeam2Wins}
              class="flex-1"
              variant="destructive"
              disabled={team2Score === 10}
            >
              They won &nbsp; 😓
            </Button>
          </div>
        </div>
      {/if}

      {#if losingTeam}
        <div id="score-step" class="mt-6 flex flex-col gap-4" transition:fade>
          <h2 class="text-center text-4xl">
            What was {losingTeam === 'team1' ? 'your' : 'their'} score?
          </h2>
          <div class="grid grid-cols-5 gap-2">
            {#each Array.from({ length: 10 }, (_, i) => i) as score}
              <Button
                type="button"
                variant={(losingTeam === 'team1' ? team1Score : team2Score) ===
                score
                  ? 'default'
                  : 'outline'}
                onclick={() => {
                  if (losingTeam === 'team1') team1Score = score;
                  else if (losingTeam === 'team2') team2Score = score;
                  goto('#submit-step');
                }}
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
          {#key team1Score + ':' + team2Score}
            <MatchCard match={previewMatch()} showMmr={false} />
          {/key}
          <Button type="submit">Submit the match</Button>
        </div>
      {/if}
    </div>
  </form>
</div>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Add new player</Dialog.Title>
      <Dialog.Description>
        Create a player for this match. If you add an email, the address can be
        claimed later.
      </Dialog.Description>
    </Dialog.Header>

    <div class="mt-4 flex flex-col gap-4">
      {#if dialogError}
        <Alert variant="destructive">{dialogError}</Alert>
      {/if}

      <div class="space-y-2">
        <Label for="new-player-display-name">Display name</Label>
        <Input
          id="new-player-display-name"
          bind:value={dialogDisplayName}
          placeholder="New teammate"
        />
      </div>
      <div class="space-y-2">
        <Label for="new-player-email">Email (optional)</Label>
        <Input
          id="new-player-email"
          bind:value={dialogEmail}
          type="email"
          placeholder="new.player@example.com"
        />
      </div>
    </div>

    <Dialog.Footer class="mt-4 gap-2">
      <Button
        type="button"
        variant="outline"
        onclick={() => (dialogOpen = false)}
      >
        Cancel
      </Button>
      <Button type="button" onclick={saveNewPlayer}>Use player</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<LoadingOverlay isLoading={submitting} message="Uploading match result" />
