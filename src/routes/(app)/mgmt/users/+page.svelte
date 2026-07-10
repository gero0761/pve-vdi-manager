<script lang="ts">
	import { enhance } from '$app/forms';
	import DataTable from '$lib/components/DataTable.svelte';
	import CreateUserModal from '$lib/components/CreateUserModal.svelte';
	let { data, form } = $props();

	// ─── Password Change Modal ────────────────────────────────────────────────
	let selectedUserId = $state<string | null>(null);
	let showPasswordModal = $state(false);

	function openPasswordModal(id: string) {
		selectedUserId = id;
		showPasswordModal = true;
	}
	function closePasswordModal() {
		showPasswordModal = false;
		selectedUserId = null;
	}

	// ─── Create User Modal ────────────────────────────────────────────────────
	let showCreateModal = $state(false);

	function openCreateModal() {
		showCreateModal = true;
	}
	function closeCreateModal() {
		showCreateModal = false;
	}
</script>

<!-- ═══════════════════════════════════════ MAIN PAGE ═════════════════════ -->
<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<header class="mb-10 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight text-white">User Management</h1>
			<p class="mt-2 text-sm text-gray-400">View and manage system users and their permissions.</p>
		</div>
		{#if data.canCreateUsers}
			<button
				onclick={openCreateModal}
				class="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 hover:scale-105 active:scale-100"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
				</svg>
				Create User
			</button>
		{/if}
	</header>

	{#if form?.error}
		<div class="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400">
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div class="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-400">
			Action completed successfully.
		</div>
	{/if}

	<DataTable
		columns={[
			{ label: 'User', sortKey: 'username' },
			{ label: 'Role', sortKey: 'role' },
			{ label: 'Actions', class: 'text-right' }
		]}
		rows={data.users}
		getRowId={(u) => u.id}
		emptyMessage="No users found."
	>
		{#snippet row(user)}
			<td class="px-8 py-4">
				<div class="flex flex-col">
					<a href="/mgmt/users/{user.id}" class="font-bold text-gray-200 hover:text-indigo-400 transition-colors">
						{user.username}
						<span class="ml-2 font-normal text-gray-500">({user.first_name} {user.last_name})</span>
					</a>
					<span class="text-xs text-gray-500 font-mono">{user.id}</span>
				</div>
			</td>
			<td class="px-8 py-4">
				<form method="POST" action="?/updateRole" use:enhance>
					<input type="hidden" name="id" value={user.id} />
					<select
						name="role"
						value={user.role}
						onchange={(e) => (e.target as HTMLFormElement).form?.requestSubmit()}
						disabled={user.id === data.user?.id || !data.isAdmin}
						class="rounded-md bg-gray-900 border border-gray-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-tight
						{user.role === 'admin' ? 'text-rose-400 border-rose-500/20' : 'text-gray-400'}
						focus:border-indigo-500 focus:ring-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
					>
						<option value="user">User</option>
						<option value="admin">Admin</option>
					</select>
				</form>
			</td>
			<td class="px-8 py-4 text-right">
				<div class="flex items-center justify-end gap-3">
					<a href="/mgmt/users/{user.id}" class="rounded-lg bg-indigo-600/10 px-3 py-1.5 text-xs font-bold text-indigo-400 border border-indigo-600/20 hover:bg-indigo-600 hover:text-white transition-all">
						Edit Access
					</a>
					<button
						onclick={() => openPasswordModal(user.id)}
						class="rounded-lg bg-amber-600/10 px-3 py-1.5 text-xs font-bold text-amber-400 border border-amber-600/20 hover:bg-amber-600 hover:text-white transition-all"
					>
						Password
					</button>
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={user.id} />
						<button
							type="submit"
							class="rounded-lg bg-red-600/10 px-3 py-1.5 text-xs font-bold text-red-400 border border-red-600/20 hover:bg-red-600 hover:text-white transition-all disabled:opacity-20"
							disabled={user.id === data.user?.id}
						>
							Delete
						</button>
					</form>
				</div>
			</td>
		{/snippet}
	</DataTable>
</div>

<!-- ═══════════════════════════════════ PASSWORD MODAL ════════════════════ -->
{#if showPasswordModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
		<div class="w-full max-w-md overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl">
			<div class="border-b border-gray-700 bg-gray-800/50 px-6 py-4">
				<h3 class="text-lg font-bold text-white">Change User Password</h3>
			</div>
			<form method="POST" action="?/changePassword" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') closePasswordModal();
				};
			}} class="p-6">
				<input type="hidden" name="id" value={selectedUserId} />
				<div class="space-y-4">
					<div class="space-y-2">
						<label for="password" class="block text-xs font-bold text-gray-400 uppercase tracking-tight">New Password</label>
						<input type="password" id="password" name="password" required class="w-full rounded-xl border-gray-700 bg-gray-900 py-2.5 px-4 text-gray-200 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
					</div>
					<div class="space-y-2">
						<label for="passwordConfirm" class="block text-xs font-bold text-gray-400 uppercase tracking-tight">Confirm Password</label>
						<input type="password" id="passwordConfirm" name="passwordConfirm" required class="w-full rounded-xl border-gray-700 bg-gray-900 py-2.5 px-4 text-gray-200 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
					</div>
				</div>
				<div class="mt-8 flex gap-3">
					<button type="button" onclick={closePasswordModal} class="flex-1 rounded-xl bg-gray-700 py-3 font-bold text-white hover:bg-gray-600 transition-all">Cancel</button>
					<button type="submit" class="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all">Update Password</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ═══════════════════════════════════ CREATE USER MODAL ═════════════════ -->
{#if showCreateModal}
	<CreateUserModal isAdmin={data.isAdmin} onclose={closeCreateModal} />
{/if}

<!-- ═══════════════════════ PRINT STYLES ════════════════════════════════ -->
<style>
	@media print {
		/* hide everything */
		:global(body > *) { display: none !important; }
		/* show only the credentials table */
		#credentials-print-area { display: block !important; }
		:global(#credentials-print-area) {
			display: block !important;
			position: fixed;
			inset: 0;
			background: white;
			color: black;
			padding: 2rem;
			font-family: sans-serif;
		}
		:global(#credentials-print-area table) { width: 100%; border-collapse: collapse; }
		:global(#credentials-print-area th, #credentials-print-area td) {
			border: 1px solid #ccc;
			padding: 8px 12px;
			text-align: left;
			color: black !important;
		}
		:global(#credentials-print-area thead) { background: #f0f0f0; }
	}
</style>
