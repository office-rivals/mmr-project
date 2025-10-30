<script lang="ts">
	import type { LayoutData } from './$types';
	import { page } from '$app/stores';
	import { LayoutDashboard, ClipboardList, Shield, ArrowLeft } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';
	import '../../app.pcss';

	let { data, children }: { data: LayoutData; children: any } = $props();
	const { userRole } = data;

	const navItems = [
		{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/admin/calculations', label: 'Match Management', icon: ClipboardList }
	];

	if (userRole === 'Owner') {
		navItems.push({ href: '/admin/roles', label: 'Role Management', icon: Shield });
	}

	const isActive = (href: string) => {
		return $page.url.pathname === href;
	};

	const getRoleBadgeVariant = (role: string) => {
		if (role === 'Owner') return 'owner';
		if (role === 'Moderator') return 'moderator';
		return 'user';
	};
</script>

<div class="dark flex min-h-screen bg-background text-foreground">
	<aside class="sticky top-0 flex h-screen w-64 flex-col border-r border-border bg-card">
		<div class="flex h-16 items-center border-b border-border px-6">
			<h2 class="text-xl font-bold text-foreground">Admin Panel</h2>
		</div>

		<nav class="flex-1 space-y-1 overflow-y-auto p-4">
			{#each navItems as item}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(
						item.href
					)
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
				>
					<svelte:component this={item.icon} class="h-5 w-5" />
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>

		<div class="space-y-4 border-t border-border p-4">
			<div class="flex items-center justify-between">
				<span class="text-sm text-muted-foreground">Role:</span>
				<Badge variant={getRoleBadgeVariant(userRole || 'User')}>{userRole || 'User'}</Badge>
			</div>
			<a
				href="/"
				class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
			>
				<ArrowLeft class="h-4 w-4" />
				<span>Back to App</span>
			</a>
		</div>
	</aside>

	<main class="flex-1 overflow-auto p-8">
		<div class="mx-auto max-w-7xl">
			{@render children()}
		</div>
	</main>
</div>
