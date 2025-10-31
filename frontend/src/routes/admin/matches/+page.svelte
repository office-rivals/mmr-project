<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Alert } from '$lib/components/ui/alert';
	import * as Dialog from '$lib/components/ui/dialog';
	import { ClipboardList, Play, CheckCircle, AlertCircle, Check, AlertTriangle } from 'lucide-svelte';
	import { MatchCard } from '$lib/components/match-card';
	import type { MatchUser } from '$lib/components/match-card/match-user';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedMatchId = $state<number | null>(null);
	let showConfirmDialog = $state(false);
	let formElement: HTMLFormElement;

	const users: MatchUser[] = data.users.map(user => ({
		userId: user.userId ?? 0,
		name: user.displayName ?? 'Unknown'
	}));

	function handleConfirm() {
		showConfirmDialog = false;
		formElement?.requestSubmit();
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
								<MatchCard {users} {match} showMmr={false} />
							</button>
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
