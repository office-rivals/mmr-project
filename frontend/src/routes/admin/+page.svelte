<script lang="ts">
	import type { PageData } from './$types';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Calendar, Activity, CheckCircle, ClipboardList, Users, Shield } from 'lucide-svelte';
	import { PlayerRole } from '../../api';

	let { data }: { data: PageData } = $props();
	const { currentSeason, userRole } = data;
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
		<p class="text-muted-foreground">Welcome to the admin panel</p>
	</div>

	<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Current Season</CardTitle>
				<Calendar class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				{#if currentSeason}
					<div class="space-y-1">
						<div class="text-2xl font-bold">Season {currentSeason.id}</div>
						<p class="text-xs text-muted-foreground">
							Started: {currentSeason.startsAt ? new Date(currentSeason.startsAt).toLocaleDateString() : 'N/A'}
						</p>
					</div>
				{:else}
					<div class="text-sm text-muted-foreground">No active season</div>
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">System Status</CardTitle>
				<Activity class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="flex items-center space-x-2">
					<CheckCircle class="h-5 w-5 text-green-500" />
					<div class="text-xl font-semibold">Operational</div>
				</div>
				<p class="text-xs text-muted-foreground mt-1">All systems running normally</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Your Role</CardTitle>
				<Shield class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{userRole}</div>
				<p class="text-xs text-muted-foreground mt-1">Admin access level</p>
			</CardContent>
		</Card>
	</div>

	<Card>
		<CardHeader>
			<CardTitle>Quick Actions</CardTitle>
			<CardDescription>Common administrative tasks</CardDescription>
		</CardHeader>
		<CardContent>
			<div class="flex flex-wrap gap-3">
				<Button href="/admin/matches" class="gap-2">
					<ClipboardList class="h-4 w-4" />
					Match Management
				</Button>
				{#if userRole === PlayerRole.Owner || userRole === PlayerRole.Moderator}
					<Button href="/admin/users" variant="secondary" class="gap-2">
						<Users class="h-4 w-4" />
						User Management
					</Button>
				{/if}
			</div>
		</CardContent>
	</Card>
</div>
