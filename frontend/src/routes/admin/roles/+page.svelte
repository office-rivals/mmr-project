<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Alert } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { Users, CheckCircle, AlertCircle, Search, Pencil } from 'lucide-svelte';
	import type { PlayerRole, UserDetails } from '../../../api';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let users = $state<UserDetails[]>(data.users);
	let userRoles = $state<Record<number, { role: PlayerRole; loading: boolean }>>({});
	let filterText = $state('');
	let editingUser = $state<UserDetails | null>(null);
	let dialogOpen = $state(false);
	let editForm = $state({ name: '', displayName: '', role: 'User' as PlayerRole });

	const getRoleBadgeVariant = (role: PlayerRole) => {
		if (role === 'Owner') return 'owner';
		if (role === 'Moderator') return 'moderator';
		return 'user';
	};

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

	// Sync users when page data changes
	$effect(() => {
		users = data.users;
	});

	// Load roles for all users
	$effect(() => {
		users.forEach((user) => {
			if (!userRoles[user.userId]) {
				userRoles[user.userId] = { role: 'User', loading: true };
				loadUserRole(user.userId);
			}
		});
	});

	function openEditDialog(user: UserDetails) {
		editingUser = user;
		editForm = {
			name: user.name,
			displayName: user.displayName || '',
			role: userRoles[user.userId]?.role || 'User'
		};
		dialogOpen = true;
	}

	const handleUpdateUser = () => {
		return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
			if (result.type === 'success' && editingUser) {
				// Update users array with new object to trigger reactivity
				users = users.map(u => {
					if (u.userId === editingUser.userId) {
						return {
							...u,
							name: editForm.name,
							displayName: editForm.displayName || null
						};
					}
					return u;
				});

				// Update role
				userRoles[editingUser.userId] = { role: editForm.role, loading: false };

				dialogOpen = false;
				editingUser = null;
			}
			await update();
		};
	};
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">User Management</h1>
		<p class="text-muted-foreground">Manage user details and roles. Only Owners can edit users.</p>
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
								<Button size="sm" variant="outline" onclick={() => openEditDialog(user)}>
									<Pencil class="h-4 w-4 mr-2" />
									Edit
								</Button>
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</CardContent>
	</Card>
</div>

{#if editingUser}
	<Dialog.Root bind:open={dialogOpen}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>Edit User</Dialog.Title>
				<Dialog.Description>
					Update user details and role. All fields are required.
				</Dialog.Description>
			</Dialog.Header>

			<form method="POST" action="?/updateUser" use:enhance={handleUpdateUser}>
				<input type="hidden" name="userId" value={editingUser.userId} />
				<input type="hidden" name="originalName" value={editingUser.name} />
				<input type="hidden" name="originalDisplayName" value={editingUser.displayName || ''} />
				<input type="hidden" name="originalRole" value={userRoles[editingUser.userId]?.role || 'User'} />

				<div class="space-y-4 py-4">
					<div class="space-y-2">
						<Label for="edit-name">Name</Label>
						<Input
							id="edit-name"
							name="name"
							bind:value={editForm.name}
							placeholder="Enter name"
							required
						/>
					</div>

					<div class="space-y-2">
						<Label for="edit-displayName">Display Name</Label>
						<Input
							id="edit-displayName"
							name="displayName"
							bind:value={editForm.displayName}
							placeholder="Enter display name (optional)"
						/>
					</div>

					<div class="space-y-2">
						<Label for="edit-role">Role</Label>
						<select
							id="edit-role"
							name="role"
							bind:value={editForm.role}
							class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
							required
						>
							<option value="User">User</option>
							<option value="Moderator">Moderator</option>
							<option value="Owner">Owner</option>
						</select>
					</div>
				</div>

				<Dialog.Footer class="gap-2">
					<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>
						Cancel
					</Button>
					<Button type="submit">Save Changes</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>
{/if}
