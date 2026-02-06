<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Alert } from '$lib/components/ui/alert';
	import { Flag, AlertCircle, Trash2 } from 'lucide-svelte';
	import type { MatchDetailsV2, UserMatchFlag } from '../../api';

	interface Props {
		match: Omit<MatchDetailsV2, 'date'> & {
			date?: Date | string;
		};
		existingFlag?: UserMatchFlag;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}

	let { match, existingFlag, open = $bindable(false), onOpenChange }: Props = $props();

	let reason = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state('');
	let showDeleteConfirm = $state(false);

	$effect(() => {
		if (existingFlag && open) {
			reason = existingFlag.reason || '';
		} else if (!open) {
			reason = '';
			showDeleteConfirm = false;
		}
	});

	const isEditMode = $derived(!!existingFlag);
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{isEditMode ? 'Edit Flag' : 'Flag Match'}</Dialog.Title>
			<Dialog.Description>
				{isEditMode
					? 'Update or delete your flag for this match.'
					: 'Report an issue with this match result. A moderator will review your submission.'}
			</Dialog.Description>
		</Dialog.Header>

		{#if errorMessage}
			<Alert variant="destructive" class="mt-4">
				<div class="flex items-center gap-2">
					<AlertCircle class="h-4 w-4" />
					<span class="font-medium">{errorMessage}</span>
				</div>
			</Alert>
		{/if}

		<form
			method="POST"
			action={isEditMode ? '?/updateFlag' : '?/flagMatch'}
			use:enhance={() => {
				isSubmitting = true;
				errorMessage = '';
				return async ({ result, update }) => {
					isSubmitting = false;
					if (result.type === 'success') {
						open = false;
						reason = '';
						errorMessage = '';
					} else if (result.type === 'failure') {
						errorMessage =
							(result.data?.message as string) ||
							`Failed to ${isEditMode ? 'update' : 'create'} flag`;
					} else {
						await update();
					}
				};
			}}
		>
			{#if isEditMode && existingFlag}
				<input type="hidden" name="flagId" value={existingFlag.id} />
			{:else}
				<input type="hidden" name="matchId" value={match.matchId} />
			{/if}

			<div class="space-y-4 py-4">
				<div class="space-y-2">
					<Label for="reason">Reason for flagging</Label>
					<textarea
						id="reason"
						name="reason"
						bind:value={reason}
						required
						rows="4"
						class="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						placeholder="Describe why this match should be reviewed..."
					></textarea>
					<p class="text-xs text-muted-foreground">
						Please provide specific details about the issue with this match.
					</p>
				</div>
			</div>

			<Dialog.Footer class="gap-2">
				{#if isEditMode}
					<Button
						type="button"
						variant="destructive"
						onclick={() => (showDeleteConfirm = true)}
						disabled={isSubmitting}
					>
						<Trash2 class="mr-2 h-4 w-4" />
						Delete Flag
					</Button>
				{/if}
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						open = false;
						reason = '';
						errorMessage = '';
					}}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting || !reason.trim()}>
					<Flag class="mr-2 h-4 w-4" />
					{isSubmitting
						? isEditMode
							? 'Updating...'
							: 'Submitting...'
						: isEditMode
							? 'Update Flag'
							: 'Submit Flag'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

{#if isEditMode && existingFlag}
	<Dialog.Root bind:open={showDeleteConfirm}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>Delete Flag</Dialog.Title>
				<Dialog.Description>
					Are you sure you want to delete this flag? This action cannot be undone.
				</Dialog.Description>
			</Dialog.Header>
			<form
				method="POST"
				action="?/deleteFlag"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ result, update }) => {
						isSubmitting = false;
						if (result.type === 'success') {
							showDeleteConfirm = false;
							open = false;
							reason = '';
							errorMessage = '';
						} else if (result.type === 'failure') {
							errorMessage = (result.data?.message as string) || 'Failed to delete flag';
							showDeleteConfirm = false;
						} else {
							await update();
						}
					};
				}}
			>
				<input type="hidden" name="flagId" value={existingFlag.id} />
				<Dialog.Footer class="gap-2">
					<Button
						type="button"
						variant="outline"
						onclick={() => (showDeleteConfirm = false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button type="submit" variant="destructive" disabled={isSubmitting}>
						{isSubmitting ? 'Deleting...' : 'Delete'}
					</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>
{/if}
