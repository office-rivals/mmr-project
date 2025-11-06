<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Alert } from '$lib/components/ui/alert';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { ClipboardList, Play, CheckCircle, AlertCircle, Check, AlertTriangle, Edit, Trash2 } from 'lucide-svelte';
	import { MatchCard } from '$lib/components/match-card';
	import type { MatchUser } from '$lib/components/match-card/match-user';
	import type { MatchDetailsV2 } from '$api';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedMatchId = $state<number | null>(null);
	let showConfirmDialog = $state(false);
	let showEditDialog = $state(false);
	let showDeleteDialog = $state(false);
	let editingMatch = $state<MatchDetailsV2 | null>(null);
	let formElement: HTMLFormElement;
	let editFormElement: HTMLFormElement;
	let deleteFormElement: HTMLFormElement;
	let isEditingMatch = $state(false);
	let isDeletingMatch = $state(false);

	let team1Player1 = $state<number>(0);
	let team1Player2 = $state<number>(0);
	let team1Score = $state<string>('');
	let team2Player1 = $state<number>(0);
	let team2Player2 = $state<number>(0);
	let team2Score = $state<string>('');
	let editSeasonId = $state<number>(0);

	const users: MatchUser[] = data.users
		.filter(user => user.userId)
		.map(user => ({
			userId: user.userId,
			name: user.name ?? 'Unknown'
		}));

	function handleConfirm() {
		showConfirmDialog = false;
		formElement?.requestSubmit();
	}

	function handleEditMatch(match: MatchDetailsV2) {
		editingMatch = match;
		team1Player1 = match.team1.member1;
		team1Player2 = match.team1.member2;
		team1Score = String(match.team1.score);
		team2Player1 = match.team2.member1;
		team2Player2 = match.team2.member2;
		team2Score = String(match.team2.score);
		editSeasonId = data.seasonId ?? 0;
		showEditDialog = true;
	}

	function handleDeleteMatch(match: MatchDetailsV2) {
		editingMatch = match;
		showDeleteDialog = true;
	}

	function handleDeleteConfirm() {
		isDeletingMatch = true;
		showDeleteDialog = false;
		deleteFormElement?.requestSubmit();
	}

	function validateEditForm(): boolean {
		if (!team1Player1 || !team1Player2 || !team2Player1 || !team2Player2) {
			return false;
		}
		if (!team1Score || !team2Score) {
			return false;
		}
		const players = [team1Player1, team1Player2, team2Player1, team2Player2];
		const uniquePlayers = new Set(players);
		if (uniquePlayers.size !== 4) {
			return false;
		}
		return true;
	}

	$effect(() => {
		if (showEditDialog) {
			isEditFormValid = validateEditForm();
		}
	});

	let isEditFormValid = $state(false);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Match Management</h1>
		<p class="text-muted-foreground">Select a match to recalculate MMR from that point onwards</p>
	</div>

	<Card>
		<CardHeader>
			<div class="flex items-center gap-2">
				<ClipboardList class="h-5 w-5 text-primary" />
				<CardTitle>Select Starting Match</CardTitle>
			</div>
			<CardDescription>
				Choose a match from the list below. All matches from this point onwards will be recalculated.
				This operation may take several minutes to complete.
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-6">
			<div class="space-y-4">
				<h3 class="text-sm font-medium">Recent Matches</h3>
				<div class="max-h-[500px] space-y-2 overflow-y-auto rounded-md border border-border p-4">
					{#if data.matches.length === 0}
						<p class="text-center text-sm text-muted-foreground">No matches found</p>
					{:else}
						{#each data.matches as match}
							<div class="relative group">
								<button
									type="button"
									class="relative w-full transition-all hover:scale-[1.02]"
									class:ring-2={selectedMatchId === match.matchId}
									class:ring-primary={selectedMatchId === match.matchId}
									class:ring-offset-2={selectedMatchId === match.matchId}
									class:ring-offset-background={selectedMatchId === match.matchId}
									onclick={() => {
										selectedMatchId = selectedMatchId === match.matchId ? null : (match.matchId ?? null);
									}}
								>
									{#if selectedMatchId === match.matchId}
										<div class="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
											<Check class="h-4 w-4" />
										</div>
									{/if}
									<MatchCard {users} {match} showMmr={true} />
								</button>
								<div class="absolute right-2 top-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
									<Button
										size="sm"
										variant="secondary"
										class="h-8 w-8 p-0"
										onclick={(e) => {
											e.stopPropagation();
											handleEditMatch(match);
										}}
									>
										<Edit class="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant="destructive"
										class="h-8 w-8 p-0"
										onclick={(e) => {
											e.stopPropagation();
											handleDeleteMatch(match);
										}}
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<form bind:this={formElement} method="POST" action="?/recalculate" use:enhance class="space-y-4">
				<input type="hidden" name="fromMatchId" value={selectedMatchId ?? ''} />

				<div class="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-4">
					<div class="space-y-1">
						<p class="text-sm font-medium">
							{selectedMatchId
								? `Recalculate from Match #${selectedMatchId}`
								: 'Recalculate all matches'}
						</p>
						<p class="text-xs text-muted-foreground">
							{selectedMatchId
								? 'This will recalculate MMR for all matches from the selected match onwards'
								: 'No match selected - this will recalculate all matches in the current season'}
						</p>
					</div>
					<Button type="button" class="gap-2" onclick={() => showConfirmDialog = true}>
						<Play class="h-4 w-4" />
						Start Recalculation
					</Button>
				</div>
			</form>

			{#if form?.success && form?.warning}
				<Alert variant="warning">
					<div class="flex flex-col gap-2">
						<div class="flex items-center gap-2">
							<AlertTriangle class="h-4 w-4" />
							<span class="font-medium">{form.warning}</span>
						</div>
						<p class="text-sm">
							You can manually recalculate MMR using the tool below.
						</p>
					</div>
				</Alert>
			{:else if form?.success}
				<Alert variant="success">
					<div class="flex items-center gap-2">
						<CheckCircle class="h-4 w-4" />
						<span class="font-medium">{form.message}</span>
					</div>
				</Alert>
			{:else if form?.success === false}
				<Alert variant="destructive">
					<div class="flex items-center gap-2">
						<AlertCircle class="h-4 w-4" />
						<span class="font-medium">{form.message}</span>
					</div>
				</Alert>
			{/if}
		</CardContent>
	</Card>
</div>

<Dialog.Root open={showConfirmDialog} onOpenChange={(open) => showConfirmDialog = open}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<AlertTriangle class="h-5 w-5 text-yellow-500" />
				Confirm MMR Recalculation
			</Dialog.Title>
			<Dialog.Description>
				{#if selectedMatchId}
					<p class="space-y-2">
						<span class="block">You are about to recalculate MMR for all matches starting from <strong>Match #{selectedMatchId}</strong> onwards.</span>
						<span class="block font-medium">This includes the selected match and all subsequent matches in the current season.</span>
					</p>
				{:else}
					<p>You are about to recalculate MMR for <strong>all matches</strong> in the current season.</p>
				{/if}
				<p class="mt-4 text-sm text-muted-foreground">This operation may take several minutes to complete and will update player ratings.</p>
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="gap-2">
			<Button variant="outline" onclick={() => showConfirmDialog = false}>Cancel</Button>
			<Button onclick={handleConfirm} class="gap-2">
				<Play class="h-4 w-4" />
				Confirm Recalculation
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root open={showEditDialog} onOpenChange={(open) => showEditDialog = open}>
	<Dialog.Content class="max-w-2xl max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Edit Match #{editingMatch?.matchId}</Dialog.Title>
			<Dialog.Description>
				Update match details. MMR will be automatically recalculated for this match and all subsequent matches.
			</Dialog.Description>
		</Dialog.Header>
		<form bind:this={editFormElement} method="POST" action="?/editMatch" use:enhance={() => {
			isEditingMatch = true;
			return async ({ result, update }) => {
				await update();
				isEditingMatch = false;
				if (result.type === 'success') {
					showEditDialog = false;
					window.location.reload();
				}
			};
		}}>
			<input type="hidden" name="matchId" value={editingMatch?.matchId ?? ''} />
			<input type="hidden" name="seasonId" value={editSeasonId ?? ''} />

			{#if form?.success === false}
				<Alert variant="destructive" class="mt-4">
					<div class="flex items-center gap-2">
						<AlertCircle class="h-4 w-4" />
						<span class="font-medium">{form.message}</span>
					</div>
				</Alert>
			{/if}

			<div class="space-y-6 py-4">
				<div class="space-y-4">
					<h3 class="font-semibold">Team 1</h3>
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="team1Player1">Player 1</Label>
							<select
								id="team1Player1"
								name="team1Player1"
								bind:value={team1Player1}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
								required
							>
								<option value={0}>Select player</option>
								{#each data.users.filter(u => u.userId) as user}
									<option value={user.userId}>{user.name}</option>
								{/each}
							</select>
						</div>
						<div class="space-y-2">
							<Label for="team1Player2">Player 2</Label>
							<select
								id="team1Player2"
								name="team1Player2"
								bind:value={team1Player2}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
								required
							>
								<option value={0}>Select player</option>
								{#each data.users.filter(u => u.userId) as user}
									<option value={user.userId}>{user.name}</option>
								{/each}
							</select>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="team1Score">Score</Label>
						<Input
							id="team1Score"
							name="team1Score"
							type="number"
							min="0"
							bind:value={team1Score}
							required
						/>
					</div>
				</div>

				<div class="space-y-4">
					<h3 class="font-semibold">Team 2</h3>
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="team2Player1">Player 1</Label>
							<select
								id="team2Player1"
								name="team2Player1"
								bind:value={team2Player1}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
								required
							>
								<option value={0}>Select player</option>
								{#each data.users.filter(u => u.userId) as user}
									<option value={user.userId}>{user.name}</option>
								{/each}
							</select>
						</div>
						<div class="space-y-2">
							<Label for="team2Player2">Player 2</Label>
							<select
								id="team2Player2"
								name="team2Player2"
								bind:value={team2Player2}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
								required
							>
								<option value={0}>Select player</option>
								{#each data.users.filter(u => u.userId) as user}
									<option value={user.userId}>{user.name}</option>
								{/each}
							</select>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="team2Score">Score</Label>
						<Input
							id="team2Score"
							name="team2Score"
							type="number"
							min="0"
							bind:value={team2Score}
							required
						/>
					</div>
				</div>
			</div>
			{#if !isEditFormValid}
				<p class="text-sm text-muted-foreground px-6">
					Please ensure all 4 players are selected (must be unique) and both scores are filled.
				</p>
			{/if}
			<Dialog.Footer class="gap-2">
				<Button type="button" variant="outline" onclick={() => showEditDialog = false} disabled={isEditingMatch}>Cancel</Button>
				<Button type="submit" disabled={!isEditFormValid || isEditingMatch}>
					{isEditingMatch ? 'Updating...' : 'Save Changes'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root open={showDeleteDialog} onOpenChange={(open) => showDeleteDialog = open}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<AlertTriangle class="h-5 w-5 text-destructive" />
				Delete Match
			</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to delete Match #{editingMatch?.matchId}? This action will automatically recalculate all subsequent matches.
			</Dialog.Description>
		</Dialog.Header>
		<form bind:this={deleteFormElement} method="POST" action="?/deleteMatch" use:enhance={() => {
			return async ({ result, update }) => {
				await update();
				isDeletingMatch = false;
				if (result.type === 'success') {
					window.location.reload();
				}
			};
		}}>
			<input type="hidden" name="matchId" value={editingMatch?.matchId ?? ''} />
			<Dialog.Footer class="gap-2">
				<Button type="button" variant="outline" onclick={() => showDeleteDialog = false} disabled={isDeletingMatch}>Cancel</Button>
				<Button type="button" variant="destructive" onclick={handleDeleteConfirm} disabled={isDeletingMatch}>
					<Trash2 class="h-4 w-4 mr-2" />
					{isDeletingMatch ? 'Deleting...' : 'Delete Match'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
