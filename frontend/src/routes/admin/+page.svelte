<script lang="ts">
	import type { PageData } from './$types';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Calendar, Activity, CheckCircle, ClipboardList, Users, Shield, Flag } from 'lucide-svelte';
	import { PlayerRole } from '../../api';

	let { data }: { data: PageData } = $props();
	const { currentSeason, userRole, pendingFlagsCount, totalUsersCount, totalMatchesCount } = data;
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
		<p class="text-muted-foreground">Welcome to the admin panel</p>
	</div>

	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

		{#if userRole === PlayerRole.Owner || userRole === PlayerRole.Moderator}
			<a href="/admin/users" class="block transition-transform hover:scale-[1.02]">
				<Card class="h-full cursor-pointer hover:bg-accent/50">
					<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle class="text-sm font-medium">Total Users</CardTitle>
						<Users class="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div class="text-2xl font-bold">{totalUsersCount}</div>
						<p class="text-xs text-muted-foreground mt-1">Registered players</p>
					</CardContent>
				</Card>
			</a>
		{/if}

		<a href="/admin/matches" class="block transition-transform hover:scale-[1.02]">
			<Card class="h-full cursor-pointer hover:bg-accent/50">
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Total Matches</CardTitle>
					<ClipboardList class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{totalMatchesCount}</div>
					<p class="text-xs text-muted-foreground mt-1">Games played</p>
				</CardContent>
			</Card>
		</a>

		<a href="/admin/match-flags" class="block transition-transform hover:scale-[1.02]">
			<Card class="h-full cursor-pointer hover:bg-accent/50">
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Open Match Flags</CardTitle>
					<Flag class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{pendingFlagsCount}</div>
					<p class="text-xs text-muted-foreground mt-1">Pending review</p>
				</CardContent>
			</Card>
		</a>
	</div>
</div>
