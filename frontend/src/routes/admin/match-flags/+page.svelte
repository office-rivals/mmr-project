<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Alert } from '$lib/components/ui/alert';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import * as Table from '$lib/components/ui/table';
	import { Flag, CheckCircle, AlertCircle, Edit } from 'lucide-svelte';
	import type { MatchFlagDetails } from '../../../api';
	import EditMatchDialog from '$lib/components/admin/edit-match-dialog.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedFlag = $state<MatchFlagDetails | null>(null);
	let dialogOpen = $state(false);
	let resolutionNote = $state('');
	let showEditDialog = $state(false);
	let editingFlag = $state<MatchFlagDetails | null>(null);

	function playerName(userId: number): string {
		return data.users.find((u) => u.userId === userId)?.name ?? 'Unknown';
	}

	function matchSummary(flag: MatchFlagDetails): string {
		const m = flag.match;
		const t1p1 = playerName(m.team1.member1);
		const t1p2 = playerName(m.team1.member2);
		const t2p1 = playerName(m.team2.member1);
		const t2p2 = playerName(m.team2.member2);
		return `${t1p1} + ${t1p2} vs ${t2p1} + ${t2p2} (${m.team1.score}-${m.team2.score})`;
	}

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
		});
	}

	function truncate(text: string, max: number): string {
		return text.length > max ? text.slice(0, max) + '...' : text;
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Flagged Matches</h1>
		<p class="text-muted-foreground">Review and resolve match flags reported by users</p>
	</div>

	{#if form?.success && form.message}
		<Alert variant="success">
			<div class="flex items-center gap-2">
				<CheckCircle class="h-4 w-4" />
				<span class="font-medium">{form.message}</span>
			</div>
		</Alert>
	{:else if form?.success && form.warning}
		<Alert variant="warning">
			<div class="flex items-center gap-2">
				<AlertCircle class="h-4 w-4" />
				<span class="font-medium">{form.warning}</span>
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

	{#if data.flags.length === 0}
		<div class="flex flex-col items-center justify-center rounded-lg border border-border py-12 text-center">
			<CheckCircle class="mb-4 h-12 w-12 text-muted-foreground" />
			<h3 class="text-lg font-medium">No pending flags</h3>
			<p class="text-sm text-muted-foreground">All match flags have been resolved</p>
		</div>
	{:else}
		<div class="rounded-lg border border-border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Flagged By</Table.Head>
						<Table.Head>Match</Table.Head>
						<Table.Head>Reason</Table.Head>
						<Table.Head>Date</Table.Head>
						<Table.Head class="text-right">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.flags as flag (flag.id)}
						<Table.Row>
							<Table.Cell class="whitespace-nowrap font-medium">
								{flag.flaggedByName}
							</Table.Cell>
							<Table.Cell class="max-w-[300px]">
								<span class="text-sm" title={matchSummary(flag)}>
									{truncate(matchSummary(flag), 50)}
								</span>
							</Table.Cell>
							<Table.Cell class="max-w-[250px]">
								<span class="text-sm" title={flag.reason}>
									{truncate(flag.reason, 80)}
								</span>
							</Table.Cell>
							<Table.Cell class="whitespace-nowrap text-sm">
								{formatDate(flag.createdAt)}
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex justify-end gap-2">
									<Button size="sm" variant="outline" onclick={() => handleEditMatch(flag)}>
										<Edit class="mr-1 h-3.5 w-3.5" />
										Edit
									</Button>
									<Button size="sm" onclick={() => handleResolve(flag)}>
										<CheckCircle class="mr-1 h-3.5 w-3.5" />
										Resolve
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	{/if}
</div>

<EditMatchDialog
	match={editingFlag?.match ?? null}
	users={data.users}
	bind:open={showEditDialog}
	seasonId={data.seasonId ?? 0}
	formAction="?/editMatch"
	errorMessage={form?.success === false ? form.message : ''}
	warningMessage={form?.warning ?? ''}
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
