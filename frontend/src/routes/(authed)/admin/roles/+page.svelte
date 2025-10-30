<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const { users } = data;
</script>

<div class="roles">
	<h1>Role Management</h1>
	<p class="description">Manage user roles and permissions. Only Owners can assign roles.</p>

	{#if form?.success}
		<div class="alert alert-success">
			{form.message}
		</div>
	{:else if form?.success === false}
		<div class="alert alert-error">
			{form.message}
		</div>
	{/if}

	<div class="users-table">
		<table>
			<thead>
				<tr>
					<th>ID</th>
					<th>Name</th>
					<th>Email</th>
					<th>Current Role</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each users as user}
					<tr>
						<td>{user.id}</td>
						<td>{user.name}</td>
						<td>{user.email || 'N/A'}</td>
						<td>
							<span class="role-badge role-{user.role?.toLowerCase()}">{user.role || 'User'}</span>
						</td>
						<td>
							<form method="POST" action="?/assignRole" use:enhance class="inline-form">
								<input type="hidden" name="playerId" value={user.id} />
								<select name="role">
									<option value="User" selected={user.role === 'User'}>User</option>
									<option value="Moderator" selected={user.role === 'Moderator'}>Moderator</option>
									<option value="Owner" selected={user.role === 'Owner'}>Owner</option>
								</select>
								<button type="submit" class="btn-sm">Assign</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.roles {
		max-width: 1200px;
	}

	h1 {
		margin: 0 0 1rem 0;
	}

	.description {
		color: #666;
		margin-bottom: 2rem;
	}

	.alert {
		margin-bottom: 1.5rem;
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

	.users-table {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th {
		background-color: #f5f5f5;
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		border-bottom: 2px solid #ddd;
	}

	td {
		padding: 1rem;
		border-bottom: 1px solid #eee;
	}

	tr:last-child td {
		border-bottom: none;
	}

	.role-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.role-user {
		background-color: #e3f2fd;
		color: #1976d2;
	}

	.role-moderator {
		background-color: #fff3e0;
		color: #f57c00;
	}

	.role-owner {
		background-color: #f3e5f5;
		color: #7b1fa2;
	}

	.inline-form {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	select {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.btn-sm {
		padding: 0.5rem 1rem;
		background-color: #2196f3;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-sm:hover {
		background-color: #1976d2;
	}
</style>
