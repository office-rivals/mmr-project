<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import FreeFormScoreInputs from '$lib/components/free-form-score-inputs.svelte';
  import LoadingOverlay from '$lib/components/loading-overlay.svelte';
  import {
    deriveLosingTeam,
    isScorePairComplete,
    loserScoreOptions,
    type TeamSide,
  } from '$lib/scoring';
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

  let teamSize = $derived(data.leagueTeamSize);
  // Fixed-target leagues (foosball: 10) use the "we won / they won" + loser
  // 0..N picker. Free-form leagues (winningScore === null) take two raw scores
  // — the higher one wins, both are derived server-side.
  let winningScore = $derived(data.leagueWinningScore);
  let isFreeForm = $derived(winningScore === null);
  // 1v1 leagues only use the player1 slots; the player2 entries stay null and
  // the server action filters them out.
  let team1Slots: SlotName[] = $derived(
    teamSize >= 2 ? ['team1_player1', 'team1_player2'] : ['team1_player1']
  );
  let team2Slots: SlotName[] = $derived(
    teamSize >= 2 ? ['team2_player1', 'team2_player2'] : ['team2_player1']
  );
  let SLOTS: SlotName[] = $derived([...team1Slots, ...team2Slots]);
  let opponentLabel = $derived(teamSize >= 2 ? 'Opponent 1' : 'Opponent');

  // Stored values are LeaguePlayer ids, which are scoped to a single league —
  // a user has a different LeaguePlayer row in each league they've joined.
  // The legacy unscoped keys silently no-op across leagues; keeping them as a
  // read-only fallback preserves auto-fill for users on whichever league they
  // last submitted in before this change shipped.
  // TODO(remove-after-next-release): drop the legacy keys.
  const primaryPlayerKey = (leagueId: string) =>
    `primaryLeaguePlayerId:${leagueId}`;
  const latestPlayersKey = (leagueId: string) =>
    `latestLeaguePlayerIds:${leagueId}`;
  const LEGACY_PRIMARY_PLAYER_KEY = 'primaryLeaguePlayerId';
  const LEGACY_LATEST_PLAYERS_KEY = 'latestLeaguePlayerIds';

  let slots = $state<Record<SlotName, SlotValue>>({
    team1_player1: null,
    team1_player2: null,
    team2_player1: null,
    team2_player2: null,
  });
  let latestPlayerIds = $state<string[]>([]);
  let team1Score = $state(-1);
  let team2Score = $state(-1);

  // The page component is reused across league navigations, so per-league
  // selections must be cleared when data.leagueId changes; otherwise the form
  // would submit a LeaguePlayer.id that belongs to the previous league.
  let hydratedLeagueId: string | null = null;
  $effect(() => {
    if (!browser) return;
    if (hydratedLeagueId === data.leagueId) return;
    hydratedLeagueId = data.leagueId;

    slots = {
      team1_player1: null,
      team1_player2: null,
      team2_player1: null,
      team2_player2: null,
    };
    team1Score = -1;
    team2Score = -1;
    latestPlayerIds = [];

    const primaryId =
      window.localStorage.getItem(primaryPlayerKey(data.leagueId)) ??
      window.localStorage.getItem(LEGACY_PRIMARY_PLAYER_KEY);
    if (primaryId) {
      const player = data.players.find((p) => p.id === primaryId);
      if (player) slots.team1_player1 = { kind: 'league', player };
    }

    const stored =
      window.localStorage.getItem(latestPlayersKey(data.leagueId)) ??
      window.localStorage.getItem(LEGACY_LATEST_PLAYERS_KEY);
    if (stored) latestPlayerIds = stored.split(',').filter(Boolean);
  });

  let dialog = $state({
    open: false,
    slot: 'team1_player1' as SlotName,
    displayName: '',
    username: '',
    email: '',
    error: '',
  });

  let submitting = $state(false);

  function openNewPlayerDialog(slot: SlotName, suggested: string) {
    dialog = {
      open: true,
      slot,
      displayName: suggested,
      username: '',
      email: '',
      error: '',
    };
  }

  function saveNewPlayer() {
    if (dialog.displayName.trim() === '') {
      dialog.error = 'Display name is required';
      return;
    }
    slots[dialog.slot] = {
      kind: 'new',
      displayName: dialog.displayName.trim(),
      username: dialog.username.trim(),
      email: dialog.email.trim(),
    };
    dialog.open = false;
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
  let team1Filled = $derived(team1Slots.every((s) => slots[s] !== null));

  let exclusions = $derived(
    SLOTS.map((s) => slotExclusion(slots[s])).filter((v): v is string => !!v)
  );

  let loserScores = $derived(loserScoreOptions(winningScore));

  let losingTeam: TeamSide | null = $derived(
    deriveLosingTeam(team1Score, team2Score, winningScore)
  );

  let isPreviewVisible = $derived(
    isScorePairComplete(team1Score, team2Score, winningScore)
  );

  // Only reachable from the fixed-target winner buttons; the null check
  // narrows the type and fails closed if that ever changes.
  function setTeam1Wins() {
    if (winningScore === null) return;
    team1Score = winningScore;
    team2Score = -1;
    goto('#score-step');
  }

  function setTeam2Wins() {
    if (winningScore === null) return;
    team2Score = winningScore;
    team1Score = -1;
    goto('#score-step');
  }

  function previewMatch(): MatchResponse {
    const playerNames = (
      slot: SlotValue
    ): { displayName?: string; username?: string } => {
      if (slot === null) return { displayName: 'Unknown' };
      if (slot.kind === 'league')
        return {
          displayName: slot.player.displayName,
          username: slot.player.username,
        };
      if (slot.kind === 'member')
        return {
          displayName: slot.member.displayName,
          username: slot.member.username,
        };
      return {
        displayName: slot.displayName,
        username: slot.username || undefined,
      };
    };

    const team1Players = team1Slots.map((s) => slots[s]);
    const team2Players = team2Slots.map((s) => slots[s]);

    const safeT1 = team1Score === -1 ? 0 : team1Score;
    const safeT2 = team2Score === -1 ? 0 : team2Score;

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
          score: safeT1,
          isWinner: safeT1 > safeT2,
          players: team1Players.map((s, i) => ({
            id: `t1p${i}`,
            leaguePlayerId: '',
            ...playerNames(s),
            index: i,
          })),
        },
        {
          id: 't2',
          index: 1,
          score: safeT2,
          isWinner: safeT2 > safeT1,
          players: team2Players.map((s, i) => ({
            id: `t2p${i}`,
            leaguePlayerId: '',
            ...playerNames(s),
            index: i,
          })),
        },
      ],
    };
  }

  function onBeforeSubmit() {
    if (!browser) return;
    const enteredIds = SLOTS.map((s) => {
      const v = slots[s];
      return v?.kind === 'league' ? v.player.id : null;
    }).filter((v): v is string => !!v);

    if (enteredIds[0]) {
      window.localStorage.setItem(
        primaryPlayerKey(data.leagueId),
        enteredIds[0]
      );
    }
    const merged = [
      ...enteredIds,
      ...latestPlayerIds.filter((id) => !enteredIds.includes(id)),
    ].slice(0, 10);
    window.localStorage.setItem(
      latestPlayersKey(data.leagueId),
      merged.join(',')
    );
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
        <input
          type="hidden"
          name="{slot}_username"
          value={slots[slot].username}
        />
        <input type="hidden" name="{slot}_email" value={slots[slot].email} />
      {/if}
    {/each}
    <input type="hidden" name="team1_score" value={team1Score} />
    <input type="hidden" name="team2_score" value={team2Score} />

    {#snippet field(slot: SlotName, label: string, autofocus = false)}
      <TeamMemberField
        {label}
        {autofocus}
        value={slots[slot]}
        onChange={(v) => (slots[slot] = v)}
        leaguePlayers={data.players}
        orgMembers={data.members}
        {latestPlayerIds}
        excludeIds={exclusions}
        onCreateUser={(suggested) => openNewPlayerDialog(slot, suggested)}
      />
    {/snippet}

    <div class="flex flex-col gap-2">
      <div class="flex gap-3">
        <div id="team1-step" class="flex flex-1 flex-col gap-4">
          <h3 class="mb-2 text-center text-2xl">Team 1</h3>
          {@render field('team1_player1', 'You', true)}
          {#if teamSize >= 2 && (slots.team1_player1 !== null || slots.team1_player2 !== null)}
            {@render field('team1_player2', 'Your teammate')}
          {/if}
        </div>
        <div class="min-h-full w-px bg-border"></div>
        <div id="team2-step" class="flex flex-1 flex-col gap-4">
          <h3 class="mb-2 text-center text-2xl">Team 2</h3>
          {#if team1Filled || slots.team2_player1 !== null}
            {@render field('team2_player1', opponentLabel)}
          {/if}
          {#if teamSize >= 2 && (slots.team2_player1 !== null || slots.team2_player2 !== null)}
            {@render field('team2_player2', 'Opponent 2')}
          {/if}
        </div>
      </div>

      {#if allFilled && !isFreeForm}
        <div id="winner-step" class="mt-6 flex flex-col gap-4" transition:fade>
          <h2 class="text-center text-4xl">Who won?</h2>
          <div class="flex flex-row gap-4">
            <Button
              type="button"
              onclick={setTeam1Wins}
              class="flex-1"
              variant="default"
              disabled={team1Score === winningScore}
            >
              We won &nbsp; 🎉
            </Button>
            <div class="min-h-full w-px bg-border"></div>
            <Button
              type="button"
              onclick={setTeam2Wins}
              class="flex-1"
              variant="destructive"
              disabled={team2Score === winningScore}
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
            {#each loserScores as score}
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

      {#if allFilled && isFreeForm}
        <div
          id="free-form-score-step"
          class="mt-6 flex flex-col gap-4"
          transition:fade
        >
          <h2 class="text-center text-4xl">What was the final score?</h2>
          <FreeFormScoreInputs
            team1Label="Your score"
            team2Label="Their score"
            bind:team1Score
            bind:team2Score
          />
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

<Dialog.Root bind:open={dialog.open}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Add new player</Dialog.Title>
      <Dialog.Description>
        Create a player for this match. If you add an email, the address can be
        claimed later.
      </Dialog.Description>
    </Dialog.Header>

    <div class="mt-4 flex flex-col gap-4">
      {#if dialog.error}
        <Alert variant="destructive">{dialog.error}</Alert>
      {/if}

      <div class="space-y-2">
        <Label for="new-player-display-name">Display name</Label>
        <Input
          id="new-player-display-name"
          bind:value={dialog.displayName}
          placeholder="New teammate"
          spellcheck={false}
          autocorrect="off"
        />
      </div>
      <div class="space-y-2">
        <Label for="new-player-username">Username (optional)</Label>
        <Input
          id="new-player-username"
          bind:value={dialog.username}
          placeholder="short-handle"
          spellcheck={false}
          autocorrect="off"
          autocapitalize="none"
        />
      </div>
      <div class="space-y-2">
        <Label for="new-player-email">Email (optional)</Label>
        <Input
          id="new-player-email"
          bind:value={dialog.email}
          type="email"
          placeholder="new.player@example.com"
        />
      </div>
    </div>

    <Dialog.Footer class="mt-4 gap-2">
      <Button
        type="button"
        variant="outline"
        onclick={() => (dialog.open = false)}
      >
        Cancel
      </Button>
      <Button type="button" onclick={saveNewPlayer}>Use player</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<LoadingOverlay isLoading={submitting} message="Uploading match result" />
