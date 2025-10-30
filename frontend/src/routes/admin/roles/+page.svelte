<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Alert } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { Users, CheckCircle, AlertCircle, Search } from 'lucide-svelte';
	import type { PlayerRole } from '../../../api';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const { users } = data;

	const getRoleBadgeVariant = (role: PlayerRole) => {
		if (role === 'Owner') return 'owner';
		if (role === 'Moderator') return 'moderator';
		return 'user';
	};

	let userRoles = $state<Record<number, { role: PlayerRole; loading: boolean }>>({});
	let filterText = $state('');

	const filteredUsers = $derived(
		users.filter((user) => {
			if (!filterText) return true;
			const searchTerm = filterText.toLowerCase();
			return (
				user.name?.toLowerCase().includes(searchTerm) ||
				user.displayName?.toLowerCase().includes(searchTerm)
			);
		})
	);

	async function loadUserRole(userId: number) {
		try {
			const response = await fetch(`/api/roles/${userId}`);
			if (response.ok) {
				const data = await response.json();
				userRoles[userId] = { role: data.role || 'User', loading: false };
			} else {
				userRoles[userId] = { role: 'User', loading: false };
			}
		} catch {
			userRoles[userId] = { role: 'User', loading: false };
		}
	}

	$effect(() => {
		users.forEach((user) => {
			if (!userRoles[user.userId]) {
				userRoles[user.userId] = { role: 'User', loading: true };
				loadUserRole(user.userId);
			}
		});
	});

	const handleRoleAssignment = ({ formData }: { formData: FormData }) => {
		const playerId = Number(formData.get('playerId'));
		const role = formData.get('role') as PlayerRole;

		return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				userRoles[playerId] = { role, loading: false };
			}
			await update();
		};
	};
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Role Management</h1>
		<p class="text-muted-foreground">Manage user roles and permissions. Only Owners can assign roles.</p>
	</div>

	<div class="relative">
		<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			bind:value={filterText}
			type="text"
			placeholder="Filter by name or display name..."
			class="pl-9"
		/>
	</div>

	{#if form?.success}
		<Alert variant="success">
			<div class="flex items-center gap-2">
				<CheckCircle class="h-4 w-4" />
				<span class="font-medium">{form.message}</span>
			</div>
		</Alert>
	{:else if form?.success === false}
		<Alert variant="destructive">
			<div class="flex items-center gap-2">
				<AlertCircle class="h-4 w-4" />
				<span class="font-medium">{form.message}</span>
			</div>
		</Alert>
	{/if}

	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Users class="h-5 w-5 text-primary" />
					<CardTitle>Users</CardTitle>
				</div>
				<span class="text-sm text-muted-foreground">
					{#if filterText}
						{filteredUsers.length} of {users.length} total
					{:else}
						{users.length} total
					{/if}
				</span>
			</div>
			<CardDescription>View and manage user roles and permissions</CardDescription>
		</CardHeader>
		<CardContent>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>ID</TableHead>
						<TableHead>Name</TableHead>
						<TableHead>Display Name</TableHead>
						<TableHead>Current Role</TableHead>
						<TableHead class="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each filteredUsers as user}
						{@const roleInfo = userRoles[user.userId]}
						<TableRow>
							<TableCell class="font-mono text-sm">{user.userId}</TableCell>
							<TableCell class="font-medium">{user.name}</TableCell>
							<TableCell>{user.displayName || '-'}</TableCell>
							<TableCell>
								{#if roleInfo?.loading}
									<span class="text-sm text-muted-foreground">Loading...</span>
								{:else if roleInfo?.role}
									<Badge variant={getRoleBadgeVariant(roleInfo.role)}>{roleInfo.role}</Badge>
								{:else}
									<Badge variant="user">User</Badge>
								{/if}
							</TableCell>
							<TableCell class="text-right">
								<form method="POST" action="?/assignRole" use:enhance={handleRoleAssignment} class="flex items-center justify-end gap-2">
									<input type="hidden" name="playerId" value={user.userId} />
									<select
										name="role"
										class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 rounded-md border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
									>
										<option value="User" selected={roleInfo?.role === 'User'}>User</option>
										<option value="Moderator" selected={roleInfo?.role === 'Moderator'}>Moderator</option>
										<option value="Owner" selected={roleInfo?.role === 'Owner'}>Owner</option>
									</select>
									<Button type="submit" size="sm">Assign</Button>
								</form>
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</CardContent>
	</Card>
</div>
