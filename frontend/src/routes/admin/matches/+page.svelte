<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Alert } from '$lib/components/ui/alert';
	import * as Dialog from '$lib/components/ui/dialog';
	import { ClipboardList, Play, CheckCircle, AlertCircle, Check, AlertTriangle, Edit, Trash2 } from 'lucide-svelte';
	import { MatchCard } from '$lib/components/match-card';
	import type { MatchUser } from '$lib/components/match-card/match-user';
	import type { MatchDetailsV2 } from '$api';
	import EditMatchDialog from '$lib/components/admin/edit-match-dialog.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedMatchId = $state<number | null>(null);
	let showConfirmDialog = $state(false);
	let showEditDialog = $state(false);
	let showDeleteDialog = $state(false);
	let editingMatch = $state<MatchDetailsV2 | null>(null);
	let formElement: HTMLFormElement;
	let deleteFormElement: HTMLFormElement;
	let isDeletingMatch = $state(false);
	let deleteErrorMessage = $state<string | null>(null);

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
		showEditDialog = true;
	}

	function handleDeleteMatch(match: MatchDetailsV2) {
		editingMatch = match;
		deleteErrorMessage = null;
		showDeleteDialog = true;
	}

	function handleDeleteConfirm() {
		deleteFormElement?.requestSubmit();
	}

	function handleEditSuccess() {
		window.location.reload();
	}
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
										onclick={(e: MouseEvent) => {
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
										onclick={(e: MouseEvent) => {
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

<EditMatchDialog
	match={editingMatch}
	users={data.users}
	bind:open={showEditDialog}
	seasonId={data.seasonId ?? 0}
	formAction="?/editMatch"
	errorMessage={form?.success === false ? form.message : ''}
	onSuccess={handleEditSuccess}
/>

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
		{#if deleteErrorMessage}
			<Alert variant="destructive" class="mt-4">
				<div class="flex items-center gap-2">
					<AlertCircle class="h-4 w-4" />
					<span class="font-medium">{deleteErrorMessage}</span>
				</div>
			</Alert>
		{/if}
		<form bind:this={deleteFormElement} method="POST" action="?/deleteMatch" use:enhance={() => {
			isDeletingMatch = true;
			deleteErrorMessage = null;
			return async ({ result, update }) => {
				await update();
				isDeletingMatch = false;
				if (result.type === 'success') {
					showDeleteDialog = false;
					window.location.reload();
				} else if (result.type === 'failure') {
					deleteErrorMessage = form?.message ?? 'Failed to delete match';
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
