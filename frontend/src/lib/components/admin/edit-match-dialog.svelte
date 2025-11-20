<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert } from '$lib/components/ui/alert';
	import { AlertCircle } from 'lucide-svelte';
	import type { MatchDetailsV2, UserDetails } from '../../../api';

	interface Props {
		match: MatchDetailsV2 | null;
		users: UserDetails[];
		open?: boolean;
		seasonId: number;
		formAction?: string;
		errorMessage?: string;
		onOpenChange?: (open: boolean) => void;
		onSuccess?: () => void;
	}

	let {
		match,
		users,
		open = $bindable(false),
		seasonId,
		formAction = '?/editMatch',
		errorMessage = '',
		onOpenChange,
		onSuccess
	}: Props = $props();

	let team1Player1 = $state<number>(0);
	let team1Player2 = $state<number>(0);
	let team1Score = $state<string>('');
	let team2Player1 = $state<number>(0);
	let team2Player2 = $state<number>(0);
	let team2Score = $state<string>('');
	let isEditingMatch = $state(false);
	let editFormElement: HTMLFormElement;

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
		if (match && open) {
			team1Player1 = match.team1.member1;
			team1Player2 = match.team1.member2;
			team1Score = String(match.team1.score);
			team2Player1 = match.team2.member1;
			team2Player2 = match.team2.member2;
			team2Score = String(match.team2.score);
		}
	});

	$effect(() => {
		if (open) {
			isEditFormValid = validateEditForm();
		}
	});

	let isEditFormValid = $state(false);
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content class="max-w-2xl max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Edit Match #{match?.matchId}</Dialog.Title>
			<Dialog.Description>
				Update match details. MMR will be automatically recalculated for this match and all
				subsequent matches.
			</Dialog.Description>
		</Dialog.Header>
		<form
			bind:this={editFormElement}
			method="POST"
			action={formAction}
			use:enhance={() => {
				isEditingMatch = true;
				return async ({ result, update }) => {
					await update();
					isEditingMatch = false;
					if (result.type === 'success') {
						open = false;
						if (onSuccess) {
							onSuccess();
						}
					}
				};
			}}
		>
			<input type="hidden" name="matchId" value={match?.matchId ?? ''} />
			<input type="hidden" name="seasonId" value={seasonId ?? ''} />

			{#if errorMessage}
				<Alert variant="destructive" class="mt-4">
					<div class="flex items-center gap-2">
						<AlertCircle class="h-4 w-4" />
						<span class="font-medium">{errorMessage}</span>
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
								{#each users.filter((u) => u.userId) as user}
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
								{#each users.filter((u) => u.userId) as user}
									<option value={user.userId}>{user.name}</option>
								{/each}
							</select>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="team1Score">Score</Label>
						<Input id="team1Score" name="team1Score" type="number" min="0" bind:value={team1Score} required />
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
								{#each users.filter((u) => u.userId) as user}
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
								{#each users.filter((u) => u.userId) as user}
									<option value={user.userId}>{user.name}</option>
								{/each}
							</select>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="team2Score">Score</Label>
						<Input id="team2Score" name="team2Score" type="number" min="0" bind:value={team2Score} required />
					</div>
				</div>
			</div>
			{#if !isEditFormValid}
				<p class="text-sm text-muted-foreground px-6">
					Please ensure all 4 players are selected (must be unique) and both scores are filled.
				</p>
			{/if}
			<Dialog.Footer class="gap-2">
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						open = false;
					}}
					disabled={isEditingMatch}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={!isEditFormValid || isEditingMatch}>
					{isEditingMatch ? 'Updating...' : 'Save Changes'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
