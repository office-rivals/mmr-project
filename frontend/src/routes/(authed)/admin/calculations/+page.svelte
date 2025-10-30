<script lang="ts">
	import type { ActionData } from './$types';
	import { enhance } from '$app/forms';

	let { form }: { form: ActionData } = $props();
</script>

<div class="calculations">
	<h1>MMR Calculations</h1>

	<div class="card">
		<h2>Recalculate MMR</h2>
		<p class="description">
			Recalculate MMR for all matches in the current season. This operation may take several
			minutes.
		</p>

		<form method="POST" action="?/recalculate" use:enhance>
			<div class="form-group">
				<label for="fromMatchId">From Match ID (optional)</label>
				<input
					type="number"
					id="fromMatchId"
					name="fromMatchId"
					placeholder="Leave empty to recalculate all matches"
				/>
				<small>If specified, only matches from this ID onwards will be recalculated.</small>
			</div>

			<button type="submit" class="btn-primary">Start Recalculation</button>
		</form>

		{#if form?.success}
			<div class="alert alert-success">
				{form.message}
			</div>
		{:else if form?.success === false}
			<div class="alert alert-error">
				{form.message}
			</div>
		{/if}
	</div>
</div>

<style>
	.calculations {
		max-width: 800px;
	}

	h1 {
		margin: 0 0 2rem 0;
	}

	.card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 2rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.card h2 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #333;
	}

	.description {
		color: #666;
		margin-bottom: 1.5rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	small {
		display: block;
		margin-top: 0.25rem;
		color: #666;
		font-size: 0.875rem;
	}

	.btn-primary {
		background-color: #2196f3;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-primary:hover {
		background-color: #1976d2;
	}

	.alert {
		margin-top: 1.5rem;
		padding: 1rem;
		border-radius: 4px;
	}

	.alert-success {
		background-color: #e8f5e9;
		color: #2e7d32;
		border: 1px solid #81c784;
	}

	.alert-error {
		background-color: #ffebee;
		color: #c62828;
		border: 1px solid #e57373;
	}
</style>
