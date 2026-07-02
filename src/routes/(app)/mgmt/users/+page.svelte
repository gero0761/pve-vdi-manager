<script lang="ts">
	import { enhance } from '$app/forms';
	import DataTable from '$lib/components/DataTable.svelte';
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
	let createTab = $state<'single' | 'bulk'>('single');

	// Single creation state
	let singleUsername = $state('');
	let singlePassword = $state('');
	let singleFirstName = $state('');
	let singleLastName = $state('');
	let singleRole = $state('user');
	let singlePasswordVisible = $state(false);

	// Bulk creation state
	interface BulkRow {
		firstName: string;
		lastName: string;
		username: string;
		password: string;
		role: string;
	}
	let bulkRows = $state<BulkRow[]>([
		{ firstName: '', lastName: '', username: '', password: '', role: 'user' }
	]);

	// Print / credentials state
	let showCredentials = $state(false);
	let createdCredentials = $state<{ username: string; firstName: string; lastName: string; password: string; role: string }[]>([]);

	function openCreateModal() {
		showCreateModal = true;
		createTab = 'single';
		singleUsername = '';
		singlePassword = '';
		singleFirstName = '';
		singleLastName = '';
		singleRole = 'user';
		bulkRows = [{ firstName: '', lastName: '', username: '', password: '', role: 'user' }];
		showCredentials = false;
		createdCredentials = [];
	}
	function closeCreateModal() {
		showCreateModal = false;
		showCredentials = false;
	}

	// ─── Password Generator ───────────────────────────────────────────────────
	function generatePassword(): string {
		const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
		const arr = new Uint8Array(16);
		crypto.getRandomValues(arr);
		return Array.from(arr, (b) => chars[b % chars.length]).join('');
	}

	function generateSinglePassword() {
		singlePassword = generatePassword();
		singlePasswordVisible = true;
	}

	function generateBulkPasswords() {
		bulkRows = bulkRows.map((r) => ({ ...r, password: generatePassword() }));
	}

	function addBulkRow() {
		bulkRows = [...bulkRows, { firstName: '', lastName: '', username: '', password: '', role: 'user' }];
	}

	function removeBulkRow(i: number) {
		bulkRows = bulkRows.filter((_, idx) => idx !== i);
	}

	// ─── Print ────────────────────────────────────────────────────────────────
	function printCredentials() {
		window.print();
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
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
		<div class="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl flex flex-col max-h-[90vh]">

			<!-- Modal Header -->
			<div class="flex items-center justify-between border-b border-gray-700 bg-gray-800/80 px-6 py-4 shrink-0">
				<h3 class="text-xl font-bold text-white">Create User</h3>
				<button onclick={closeCreateModal} class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white transition-all">
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			{#if showCredentials}
				<!-- ─── Credentials Print View ─── -->
				<div class="flex flex-col gap-4 p-6 overflow-auto flex-1">
					<div class="flex items-center justify-between">
						<div>
							<h4 class="text-lg font-bold text-emerald-400">
								{createdCredentials.length} user{createdCredentials.length !== 1 ? 's' : ''} created successfully
							</h4>
							<p class="text-sm text-gray-400 mt-1">Save or print the credentials below — passwords are not stored in plain text.</p>
						</div>
						<button
							onclick={printCredentials}
							class="flex items-center gap-2 rounded-xl bg-gray-700 px-4 py-2 text-sm font-bold text-white hover:bg-gray-600 transition-all"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
							</svg>
							Print
						</button>
					</div>

					<!-- Print-friendly credentials table -->
					<div id="credentials-print-area" class="overflow-x-auto rounded-xl border border-gray-700">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-700 bg-gray-900/60">
									<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Name</th>
									<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Username</th>
									<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Password</th>
									<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Role</th>
								</tr>
							</thead>
							<tbody>
								{#each createdCredentials as cred, i}
									<tr class="border-b border-gray-700/50 {i % 2 === 0 ? 'bg-gray-800/50' : 'bg-gray-800/20'}">
										<td class="px-4 py-3 text-gray-200">{cred.firstName} {cred.lastName}</td>
										<td class="px-4 py-3 font-mono text-indigo-300">{cred.username}</td>
										<td class="px-4 py-3 font-mono text-amber-300 select-all">{cred.password}</td>
										<td class="px-4 py-3">
											<span class="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide {cred.role === 'admin' ? 'bg-rose-500/20 text-rose-400' : 'bg-gray-700 text-gray-400'}">
												{cred.role}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
				<div class="border-t border-gray-700 px-6 py-4 shrink-0">
					<button onclick={closeCreateModal} class="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-500 transition-all">Done</button>
				</div>

			{:else}
				<!-- ─── Tabs ─── -->
				<div class="flex border-b border-gray-700 shrink-0">
					<button
						onclick={() => (createTab = 'single')}
						class="px-6 py-3 text-sm font-bold transition-all {createTab === 'single'
							? 'border-b-2 border-indigo-500 text-white'
							: 'text-gray-400 hover:text-white'}"
					>
						Single User
					</button>
					<button
						onclick={() => (createTab = 'bulk')}
						class="px-6 py-3 text-sm font-bold transition-all {createTab === 'bulk'
							? 'border-b-2 border-indigo-500 text-white'
							: 'text-gray-400 hover:text-white'}"
					>
						Bulk Create
					</button>
				</div>

				<!-- ════════ SINGLE TAB ════════ -->
				{#if createTab === 'single'}
					<form
						method="POST"
						action="?/createUser"
						use:enhance={() => {
							return async ({ result, update }) => {
								await update({ reset: false });
								if (result.type === 'success') {
									createdCredentials = [{
										username: singleUsername,
										firstName: singleFirstName,
										lastName: singleLastName,
										password: singlePassword,
										role: singleRole
									}];
									showCredentials = true;
								}
							};
						}}
						class="flex flex-col flex-1 overflow-hidden"
					>
						<div class="flex-1 overflow-auto p-6 space-y-4">
							<!-- Name Row -->
							<div class="grid grid-cols-2 gap-4">
								<div class="space-y-1.5">
									<label class="block text-xs font-bold uppercase tracking-wide text-gray-400">First Name</label>
									<input
										type="text"
										name="firstName"
										required
										bind:value={singleFirstName}
										placeholder="Anna"
										class="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
									/>
								</div>
								<div class="space-y-1.5">
									<label class="block text-xs font-bold uppercase tracking-wide text-gray-400">Last Name</label>
									<input
										type="text"
										name="lastName"
										required
										bind:value={singleLastName}
										placeholder="Schmidt"
										class="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
									/>
								</div>
							</div>

							<!-- Username -->
							<div class="space-y-1.5">
								<label class="block text-xs font-bold uppercase tracking-wide text-gray-400">Username</label>
								<input
									type="text"
									name="username"
									required
									bind:value={singleUsername}
									placeholder="a.schmidt"
									autocomplete="off"
									class="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
								/>
							</div>

							<!-- Password -->
							<div class="space-y-1.5">
								<label class="block text-xs font-bold uppercase tracking-wide text-gray-400">Password</label>
								<div class="flex gap-2">
									<input
										type={singlePasswordVisible ? 'text' : 'password'}
										name="password"
										required
										bind:value={singlePassword}
										placeholder="Password"
										autocomplete="new-password"
										class="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 font-mono text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
									/>
									<button
										type="button"
										onclick={generateSinglePassword}
										title="Generate random password"
										class="shrink-0 rounded-xl bg-gray-700 px-3 py-2.5 text-xs font-bold text-gray-300 hover:bg-indigo-600 hover:text-white transition-all"
									>
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
										</svg>
									</button>
									<button
										type="button"
										onclick={() => (singlePasswordVisible = !singlePasswordVisible)}
										title="Toggle visibility"
										class="shrink-0 rounded-xl bg-gray-700 px-3 py-2.5 text-xs font-bold text-gray-300 hover:bg-gray-600 transition-all"
									>
										{#if singlePasswordVisible}
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
											</svg>
										{:else}
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
											</svg>
										{/if}
									</button>
								</div>
							</div>

							<!-- Role (admin only) -->
							{#if data.isAdmin}
								<div class="space-y-1.5">
									<label class="block text-xs font-bold uppercase tracking-wide text-gray-400">Role</label>
									<select
										name="role"
										bind:value={singleRole}
										class="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-gray-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
									>
										<option value="user">User</option>
										<option value="admin">Admin</option>
									</select>
								</div>
							{:else}
								<input type="hidden" name="role" value="user" />
							{/if}
						</div>

						<!-- Footer -->
						<div class="border-t border-gray-700 flex gap-3 px-6 py-4 shrink-0">
							<button type="button" onclick={closeCreateModal} class="flex-1 rounded-xl bg-gray-700 py-3 font-bold text-white hover:bg-gray-600 transition-all">Cancel</button>
							<button type="submit" class="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all">Create User</button>
						</div>
					</form>

				<!-- ════════ BULK TAB ════════ -->
				{:else}
					<div class="flex flex-col flex-1 overflow-hidden">
						<div class="flex items-center justify-between gap-3 px-6 pt-5 pb-3 shrink-0">
							<p class="text-sm text-gray-400">Fill in the table below. Use the buttons to add rows or generate passwords.</p>
							<div class="flex gap-2 shrink-0">
								<button
									type="button"
									onclick={generateBulkPasswords}
									class="flex items-center gap-1.5 rounded-lg bg-amber-600/20 px-3 py-1.5 text-xs font-bold text-amber-400 border border-amber-600/20 hover:bg-amber-600 hover:text-white transition-all"
								>
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
									Generate All Passwords
								</button>
								<button
									type="button"
									onclick={addBulkRow}
									class="flex items-center gap-1.5 rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-bold text-indigo-400 border border-indigo-600/20 hover:bg-indigo-600 hover:text-white transition-all"
								>
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
									</svg>
									Add Row
								</button>
							</div>
						</div>

						<!-- Bulk table -->
						<div class="flex-1 overflow-auto px-6 pb-2">
							<div class="overflow-x-auto rounded-xl border border-gray-700">
								<table class="w-full min-w-[680px] text-sm">
									<thead>
										<tr class="border-b border-gray-700 bg-gray-900/60">
											<th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">First Name</th>
											<th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">Last Name</th>
											<th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">Username</th>
											<th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">Password</th>
											{#if data.isAdmin}
												<th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">Role</th>
											{/if}
											<th class="w-8"></th>
										</tr>
									</thead>
									<tbody>
										{#each bulkRows as row, i}
											<tr class="border-b border-gray-700/50 hover:bg-gray-700/20 group">
												<td class="px-2 py-1.5">
													<input
														type="text"
														bind:value={row.firstName}
														placeholder="First"
														class="w-full rounded-lg border border-transparent bg-gray-900 px-2.5 py-1.5 text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 group-hover:border-gray-700"
													/>
												</td>
												<td class="px-2 py-1.5">
													<input
														type="text"
														bind:value={row.lastName}
														placeholder="Last"
														class="w-full rounded-lg border border-transparent bg-gray-900 px-2.5 py-1.5 text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 group-hover:border-gray-700"
													/>
												</td>
												<td class="px-2 py-1.5">
													<input
														type="text"
														bind:value={row.username}
														placeholder="username"
														class="w-full rounded-lg border border-transparent bg-gray-900 px-2.5 py-1.5 font-mono text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 group-hover:border-gray-700"
													/>
												</td>
												<td class="px-2 py-1.5">
													<div class="flex gap-1">
														<input
															type="text"
															bind:value={row.password}
															placeholder="Password"
															class="flex-1 min-w-0 rounded-lg border border-transparent bg-gray-900 px-2.5 py-1.5 font-mono text-xs text-amber-300 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 group-hover:border-gray-700"
														/>
														<button
															type="button"
															onclick={() => (bulkRows[i] = { ...row, password: generatePassword() })}
															title="Generate password"
															class="shrink-0 rounded-lg bg-gray-800 p-1.5 text-gray-500 hover:bg-amber-600/20 hover:text-amber-400 transition-all"
														>
															<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
															</svg>
														</button>
													</div>
												</td>
												{#if data.isAdmin}
													<td class="px-2 py-1.5">
														<select
															bind:value={row.role}
															class="w-full rounded-lg border border-transparent bg-gray-900 px-2 py-1.5 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none group-hover:border-gray-700"
														>
															<option value="user">User</option>
															<option value="admin">Admin</option>
														</select>
													</td>
												{/if}
												<td class="pr-2 py-1.5">
													<button
														type="button"
														onclick={() => removeBulkRow(i)}
														disabled={bulkRows.length <= 1}
														class="rounded-lg p-1.5 text-gray-600 hover:bg-red-600/20 hover:text-red-400 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
													>
														<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
														</svg>
													</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>

						<!-- Bulk Footer -->
						<div class="border-t border-gray-700 flex gap-3 px-6 py-4 shrink-0">
							<button type="button" onclick={closeCreateModal} class="flex-1 rounded-xl bg-gray-700 py-3 font-bold text-white hover:bg-gray-600 transition-all">Cancel</button>
							<form
								method="POST"
								action="?/bulkCreate"
								use:enhance={({ formData }) => {
									formData.set('users', JSON.stringify(bulkRows));
									return async ({ result, update }) => {
										await update({ reset: false });
										if (result.type === 'success' && result.data && 'created' in result.data) {
											createdCredentials = result.data.created as typeof createdCredentials;
											showCredentials = true;
										}
									};
								}}
								class="flex-1"
							>
								<input type="hidden" name="users" value="" />
								<button type="submit" class="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all">
									Create {bulkRows.length} User{bulkRows.length !== 1 ? 's' : ''}
								</button>
							</form>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
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
