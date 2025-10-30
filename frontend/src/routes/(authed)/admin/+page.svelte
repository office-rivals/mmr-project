<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { currentSeason, userRole } = data;
</script>

<div class="dashboard">
	<h1>Admin Dashboard</h1>

	<div class="dashboard-grid">
		<div class="card">
			<h2>Current Season</h2>
			{#if currentSeason}
				<p>ID: {currentSeason.id}</p>
				<p>Starts At: {new Date(currentSeason.startsAt).toLocaleDateString()}</p>
			{:else}
				<p>No current season</p>
			{/if}
		</div>

		<div class="card">
			<h2>Quick Actions</h2>
			<ul class="action-list">
				<li>
					<a href="/admin/calculations">Recalculate MMR</a>
				</li>
				{#if userRole === 'Owner'}
					<li>
						<a href="/admin/roles">Manage Roles</a>
					</li>
				{/if}
			</ul>
		</div>

		<div class="card">
			<h2>System Status</h2>
			<p>All systems operational</p>
		</div>
	</div>
</div>

<style>
	.dashboard {
		max-width: 1200px;
	}

	h1 {
		margin: 0 0 2rem 0;
	}

	.dashboard-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.card h2 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #333;
	}

	.card p {
		margin: 0.5rem 0;
		color: #666;
	}

	.action-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.action-list li {
		margin-bottom: 0.75rem;
	}

	.action-list a {
		display: inline-block;
		padding: 0.5rem 1rem;
		background-color: #2196f3;
		color: white;
		text-decoration: none;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.action-list a:hover {
		background-color: #1976d2;
	}
</style>
