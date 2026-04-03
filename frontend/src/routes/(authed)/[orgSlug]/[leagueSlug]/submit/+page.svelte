<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Alert } from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import PageTitle from '$lib/components/page-title.svelte';
  import type {
    LeaguePlayerResponse,
    OrganizationMemberResponse,
  } from '$api3';
  import type { ActionData, PageData } from './$types';

  interface Props {
    data: PageData;
    form?: ActionData;
  }

  type SlotName =
    | 'team1_player1'
    | 'team1_player2'
    | 'team2_player1'
    | 'team2_player2';

  type NewPlayerDraft = {
    displayName: string;
    email: string;
  };

  let { data, form }: Props = $props();

  let selections = $state<Record<SlotName, string>>({
    team1_player1: '',
    team1_player2: '',
    team2_player1: '',
    team2_player2: '',
  });

  let newPlayers = $state<Record<SlotName, NewPlayerDraft>>({
    team1_player1: { displayName: '', email: '' },
    team1_player2: { displayName: '', email: '' },
    team2_player1: { displayName: '', email: '' },
    team2_player2: { displayName: '', email: '' },
  });

  let team1Score: number = $state(0);
  let team2Score: number = $state(0);

  let dialogOpen = $state(false);
  let dialogError = $state('');
  let editingSlot: SlotName = $state('team1_player1');
  let dialogDisplayName = $state('');
  let dialogEmail = $state('');

  const players: LeaguePlayerResponse[] = data.players ?? [];
  const members: OrganizationMemberResponse[] = data.members ?? [];

  function playerLabel(player: { displayName?: string | null; username?: string | null }) {
    return player.displayName ?? player.username ?? 'Unnamed player';
  }

  function memberLabel(member: {
    displayName?: string | null;
    username?: string | null;
    email?: string | null;
  }) {
    return member.displayName ?? member.username ?? member.email ?? 'Unclaimed member';
  }

  function currentValue(slot: SlotName) {
    return selections[slot];
  }

  function selectedNonNewValues() {
    return Object.values(selections).filter((value) => value !== '' && value !== 'new');
  }

  function selectableLeaguePlayers(slot: SlotName) {
    const selected = new Set(selectedNonNewValues());
    return players.filter((player) => {
      const value = `league:${player.id}`;
      return value === currentValue(slot) || !selected.has(value);
    });
  }

  function selectableOrgMembers(slot: SlotName) {
    const joinedMembershipIds = new Set(players.map((player) => player.organizationMembershipId));
    const selected = new Set(selectedNonNewValues());

    return members.filter((member) => {
      if (joinedMembershipIds.has(member.id)) {
        return false;
      }

      const value = `member:${member.id}`;
      return value === currentValue(slot) || !selected.has(value);
    });
  }

  function openNewPlayerDialog(slot: SlotName) {
    editingSlot = slot;
    dialogDisplayName = newPlayers[slot].displayName;
    dialogEmail = newPlayers[slot].email;
    dialogError = '';
    dialogOpen = true;
  }

  function saveNewPlayer() {
    if (dialogDisplayName.trim() === '') {
      dialogError = 'Display name is required';
      return;
    }

    newPlayers[editingSlot] = {
      displayName: dialogDisplayName.trim(),
      email: dialogEmail.trim(),
    };
    selections[editingSlot] = 'new';
    dialogOpen = false;
  }

  function selectionNote(slot: SlotName) {
    const value = selections[slot];
    if (value.startsWith('member:')) {
      return 'This player is already in the organization. Submitting the match will add them to this league.';
    }

    if (value === 'new' && newPlayers[slot].displayName !== '') {
      return newPlayers[slot].email !== ''
        ? `This will create a provisional player and reserve ${newPlayers[slot].email} for later claiming.`
        : 'This will create a provisional player in the organization and league.';
    }

    return null;
  }

  function hasAutoAddNotice() {
    return Object.values(selections).some((value) => value.startsWith('member:'));
  }
</script>

<div class="flex flex-col gap-8">
  <PageTitle>Submit Match</PageTitle>

  {#if form?.message}
    <Alert variant="destructive">{form.message}</Alert>
  {/if}

  {#if hasAutoAddNotice()}
    <Alert variant="warning">
      One or more selected players are organization members who are not yet in this league. They will be added to the league when you submit.
    </Alert>
  {/if}

  <form method="post" class="flex flex-col gap-6">
    <input type="hidden" name="team1_player1_displayName" value={newPlayers.team1_player1.displayName} />
    <input type="hidden" name="team1_player1_email" value={newPlayers.team1_player1.email} />
    <input type="hidden" name="team1_player2_displayName" value={newPlayers.team1_player2.displayName} />
    <input type="hidden" name="team1_player2_email" value={newPlayers.team1_player2.email} />
    <input type="hidden" name="team2_player1_displayName" value={newPlayers.team2_player1.displayName} />
    <input type="hidden" name="team2_player1_email" value={newPlayers.team2_player1.email} />
    <input type="hidden" name="team2_player2_displayName" value={newPlayers.team2_player2.displayName} />
    <input type="hidden" name="team2_player2_email" value={newPlayers.team2_player2.email} />

    <div class="bg-card flex flex-col gap-4 rounded-lg border p-4">
      <h3 class="text-lg font-semibold">Team 1</h3>

      {#each ['team1_player1', 'team1_player2'] as slotName}
        {@const slot = slotName as SlotName}
        <div class="flex flex-col gap-2">
          <div class="flex items-end gap-2">
            <label class="flex flex-1 flex-col gap-1">
              <span>{slot === 'team1_player1' ? 'Player 1' : 'Player 2'}</span>
              <select
                name={slot}
                bind:value={selections[slot]}
                class="rounded border p-2"
              >
                <option value="">Select player...</option>
                {#if selections[slot] === 'new' && newPlayers[slot].displayName !== ''}
                  <option value="new">New player: {newPlayers[slot].displayName}</option>
                {/if}
                {#if selectableLeaguePlayers(slot).length > 0}
                  <optgroup label="League players">
                    {#each selectableLeaguePlayers(slot) as player}
                      <option value={`league:${player.id}`}>
                        {playerLabel(player)}
                      </option>
                    {/each}
                  </optgroup>
                {/if}
                {#if selectableOrgMembers(slot).length > 0}
                  <optgroup label="Org members not in league">
                    {#each selectableOrgMembers(slot) as member}
                      <option value={`member:${member.id}`}>
                        {memberLabel(member)}
                      </option>
                    {/each}
                  </optgroup>
                {/if}
              </select>
            </label>

            <Button type="button" variant="outline" onclick={() => openNewPlayerDialog(slot)}>
              Add New
            </Button>
          </div>

          {#if selectionNote(slot)}
            <p class="text-muted-foreground text-sm">{selectionNote(slot)}</p>
          {/if}
        </div>
      {/each}

      <label class="flex items-center gap-2">
        Score:
        <input
          type="number"
          name="team1_score"
          bind:value={team1Score}
          min="0"
          max="99"
          class="w-20 rounded border p-2"
        />
      </label>
    </div>

    <div class="bg-card flex flex-col gap-4 rounded-lg border p-4">
      <h3 class="text-lg font-semibold">Team 2</h3>

      {#each ['team2_player1', 'team2_player2'] as slotName}
        {@const slot = slotName as SlotName}
        <div class="flex flex-col gap-2">
          <div class="flex items-end gap-2">
            <label class="flex flex-1 flex-col gap-1">
              <span>{slot === 'team2_player1' ? 'Player 1' : 'Player 2'}</span>
              <select
                name={slot}
                bind:value={selections[slot]}
                class="rounded border p-2"
              >
                <option value="">Select player...</option>
                {#if selections[slot] === 'new' && newPlayers[slot].displayName !== ''}
                  <option value="new">New player: {newPlayers[slot].displayName}</option>
                {/if}
                {#if selectableLeaguePlayers(slot).length > 0}
                  <optgroup label="League players">
                    {#each selectableLeaguePlayers(slot) as player}
                      <option value={`league:${player.id}`}>
                        {playerLabel(player)}
                      </option>
                    {/each}
                  </optgroup>
                {/if}
                {#if selectableOrgMembers(slot).length > 0}
                  <optgroup label="Org members not in league">
                    {#each selectableOrgMembers(slot) as member}
                      <option value={`member:${member.id}`}>
                        {memberLabel(member)}
                      </option>
                    {/each}
                  </optgroup>
                {/if}
              </select>
            </label>

            <Button type="button" variant="outline" onclick={() => openNewPlayerDialog(slot)}>
              Add New
            </Button>
          </div>

          {#if selectionNote(slot)}
            <p class="text-muted-foreground text-sm">{selectionNote(slot)}</p>
          {/if}
        </div>
      {/each}

      <label class="flex items-center gap-2">
        Score:
        <input
          type="number"
          name="team2_score"
          bind:value={team2Score}
          min="0"
          max="99"
          class="w-20 rounded border p-2"
        />
      </label>
    </div>

    <Button type="submit" class="w-full">Submit Match</Button>
  </form>
</div>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Add New Player</Dialog.Title>
      <Dialog.Description>
        Create a provisional player for this match. If you add an email, that address can be claimed later.
      </Dialog.Description>
    </Dialog.Header>

    <div class="mt-4 flex flex-col gap-4">
      {#if dialogError}
        <Alert variant="destructive">{dialogError}</Alert>
      {/if}

      <div class="space-y-2">
        <Label for="new-player-display-name">Display Name</Label>
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
      <Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>
        Cancel
      </Button>
      <Button type="button" onclick={saveNewPlayer}>
        Use Player
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
