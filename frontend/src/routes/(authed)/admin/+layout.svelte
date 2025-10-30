<script lang="ts">
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();
	const { userRole } = data;

	const navItems = [
		{ href: '/admin', label: 'Dashboard' },
		{ href: '/admin/calculations', label: 'MMR Calculations' }
	];

	if (userRole === 'Owner') {
		navItems.push({ href: '/admin/roles', label: 'Role Management' });
	}
</script>

<div class="admin-layout">
	<aside class="admin-sidebar">
		<h2>Admin Panel</h2>
		<nav>
			<ul>
				{#each navItems as item}
					<li>
						<a href={item.href}>{item.label}</a>
					</li>
				{/each}
			</ul>
		</nav>
		<div class="role-badge">
			<span>Role: <strong>{userRole}</strong></span>
		</div>
	</aside>
	<main class="admin-content">
		{@render children()}
	</main>
</div>

<style>
	.admin-layout {
		display: flex;
		min-height: 100vh;
	}

	.admin-sidebar {
		width: 250px;
		background-color: #f5f5f5;
		padding: 2rem;
		border-right: 1px solid #ddd;
	}

	.admin-sidebar h2 {
		margin: 0 0 2rem 0;
		font-size: 1.5rem;
	}

	.admin-sidebar nav ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.admin-sidebar nav li {
		margin-bottom: 1rem;
	}

	.admin-sidebar nav a {
		text-decoration: none;
		color: #333;
		padding: 0.5rem 1rem;
		display: block;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.admin-sidebar nav a:hover {
		background-color: #e0e0e0;
	}

	.role-badge {
		margin-top: 2rem;
		padding: 1rem;
		background-color: #e8f5e9;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.admin-content {
		flex: 1;
		padding: 2rem;
	}
</style>
