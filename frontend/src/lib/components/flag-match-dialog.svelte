<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Alert } from '$lib/components/ui/alert';
	import { Flag, AlertCircle } from 'lucide-svelte';
	import type { MatchDetailsV2 } from '../../api';

	interface Props {
		match: Omit<MatchDetailsV2, 'date'> & {
			date?: Date | string;
		};
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}

	let { match, open = $bindable(false), onOpenChange }: Props = $props();

	let reason = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state('');
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Flag Match</Dialog.Title>
			<Dialog.Description>
				Report an issue with this match result. A moderator will review your submission.
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
			action="?/flagMatch"
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
						errorMessage = result.data?.message || 'Failed to flag match';
					} else {
						await update();
					}
				};
			}}
		>
			<input type="hidden" name="matchId" value={match.matchId} />

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
					{isSubmitting ? 'Submitting...' : 'Submit Flag'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
