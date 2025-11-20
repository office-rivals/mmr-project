<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { Alert } from '$lib/components/ui/alert';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import { Flag, CheckCircle, AlertCircle, Edit } from 'lucide-svelte';
	import { MatchCard } from '$lib/components/match-card';
	import type { MatchUser } from '$lib/components/match-card/match-user';
	import type { MatchFlagDetails } from '../../../api';
	import EditMatchDialog from '$lib/components/admin/edit-match-dialog.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedFlag = $state<MatchFlagDetails | null>(null);
	let dialogOpen = $state(false);
	let resolutionNote = $state('');
	let showEditDialog = $state(false);
	let editingFlag = $state<MatchFlagDetails | null>(null);

	const users: MatchUser[] = data.users
		.filter(user => user.userId)
		.map(user => ({
			userId: user.userId,
			name: user.name ?? 'Unknown'
		}));

	function handleResolve(flag: MatchFlagDetails) {
		selectedFlag = flag;
		resolutionNote = '';
		dialogOpen = true;
	}

	function handleEditMatch(flag: MatchFlagDetails) {
		editingFlag = flag;
		showEditDialog = true;
	}

	function handleEditSuccess() {
		showEditDialog = false;
		selectedFlag = editingFlag;
		resolutionNote = '';
		dialogOpen = true;
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Flagged Matches</h1>
		<p class="text-muted-foreground">Review and resolve match flags reported by users</p>
	</div>

	{#if form?.success}
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

	<Card>
		<CardHeader>
			<div class="flex items-center gap-2">
				<Flag class="h-5 w-5 text-primary" />
				<CardTitle>Pending Flags</CardTitle>
			</div>
			<CardDescription>
				Match flags are reports from users about potential issues with match results.
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if data.flags.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<CheckCircle class="mb-4 h-12 w-12 text-muted-foreground" />
					<h3 class="text-lg font-medium">No pending flags</h3>
					<p class="text-sm text-muted-foreground">All match flags have been resolved</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each data.flags as flag}
						<div class="rounded-lg border border-border p-4 space-y-3">
							<div class="flex items-start justify-between gap-4">
								<div class="flex-1 space-y-2">
									<div class="flex items-center gap-2">
										<span class="text-sm font-medium text-muted-foreground">Flagged by:</span>
										<span class="text-sm">{flag.flaggedByName}</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="text-sm font-medium text-muted-foreground">Date:</span>
										<span class="text-sm">{formatDate(flag.createdAt)}</span>
									</div>
									<div class="space-y-1">
										<span class="text-sm font-medium text-muted-foreground">Reason:</span>
										<p class="text-sm">{flag.reason}</p>
									</div>
								</div>
								<div class="flex gap-2">
									<Button size="sm" variant="outline" onclick={() => handleEditMatch(flag)}>
										<Edit class="mr-2 h-4 w-4" />
										Edit Match
									</Button>
									<Button size="sm" onclick={() => handleResolve(flag)}>
										<CheckCircle class="mr-2 h-4 w-4" />
										Resolve
									</Button>
								</div>
							</div>
							<div class="pt-2 border-t border-border">
								<p class="text-sm font-medium text-muted-foreground mb-2">Match Details:</p>
								<MatchCard {users} match={flag.match} showMmr={true} />
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

<EditMatchDialog
	match={editingFlag?.match ?? null}
	users={data.users}
	bind:open={showEditDialog}
	seasonId={data.seasonId ?? 0}
	formAction="?/editMatch"
	errorMessage={form?.success === false ? form.message : ''}
	onSuccess={handleEditSuccess}
/>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Resolve Match Flag</Dialog.Title>
			<Dialog.Description>
				{#if selectedFlag && editingFlag && selectedFlag.id === editingFlag.id}
					Match has been updated successfully. You can now resolve this flag with an optional note explaining the changes.
				{:else}
					You are about to mark this flag as resolved. You can optionally add a resolution note.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if selectedFlag}
			<div class="space-y-4 py-4">
				<div class="rounded-lg border border-border p-3 space-y-2">
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium text-muted-foreground">Flagged by:</span>
						<span class="text-sm">{selectedFlag.flaggedByName}</span>
					</div>
					<div class="space-y-1">
						<span class="text-sm font-medium text-muted-foreground">Reason:</span>
						<p class="text-sm">{selectedFlag.reason}</p>
					</div>
				</div>

				<form method="POST" action="?/resolve" use:enhance={() => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') {
							dialogOpen = false;
							selectedFlag = null;
							resolutionNote = '';
						}
					};
				}}>
					<input type="hidden" name="flagId" value={selectedFlag.id} />

					<div class="space-y-2">
						<Label for="note">Resolution Note (Optional)</Label>
						<textarea
							id="note"
							name="note"
							bind:value={resolutionNote}
							rows="3"
							class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							placeholder="Add a note about why this flag was resolved..."
						></textarea>
					</div>

					<Dialog.Footer class="gap-2 mt-4">
						<Button type="button" variant="outline" onclick={() => {
							dialogOpen = false;
							selectedFlag = null;
							resolutionNote = '';
						}}>
							Cancel
						</Button>
						<Button type="submit">
							<CheckCircle class="mr-2 h-4 w-4" />
							Resolve Flag
						</Button>
					</Dialog.Footer>
				</form>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
