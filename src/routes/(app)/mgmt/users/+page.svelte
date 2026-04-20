<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();

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
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<header class="mb-10 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight text-white">User Management</h1>
			<p class="mt-2 text-sm text-gray-400">View and manage system users and their permissions.</p>
		</div>
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

	<div class="overflow-hidden rounded-2xl border border-gray-800 bg-gray-800 shadow-2xl ring-1 ring-white/5">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm whitespace-nowrap">
				<thead>
					<tr class="bg-gray-900/50 text-[11px] font-bold uppercase tracking-widest text-gray-500">
						<th class="px-8 py-5">User</th>
						<th class="px-8 py-5">Role</th>
						<th class="px-8 py-5 text-right">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-700/50">
					{#each data.users as user (user.id)}
						<tr class="transition-all hover:bg-white/2">
							<td class="px-8 py-4">
								<div class="flex flex-col">
									<span class="font-bold text-gray-200">{user.username} <span class="ml-2 font-normal text-gray-500">({user.first_name} {user.last_name})</span></span>
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
										disabled={user.id === data.user.id}
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
									<button onclick={() => openPasswordModal(user.id)} class="rounded-lg bg-amber-600/10 px-3 py-1.5 text-xs font-bold text-amber-400 border border-amber-600/20 hover:bg-amber-600 hover:text-white transition-all">
										Password
									</button>
									<form method="POST" action="?/delete" use:enhance>
										<input type="hidden" name="id" value={user.id} />
										<button type="submit" class="rounded-lg bg-red-600/10 px-3 py-1.5 text-xs font-bold text-red-400 border border-red-600/20 hover:bg-red-600 hover:text-white transition-all disabled:opacity-20" disabled={user.id === data.user.id}>
											Delete
										</button>
									</form>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

{#if showPasswordModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
		<div class="w-full max-w-md overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl">
			<div class="border-b border-gray-700 bg-gray-800/50 px-6 py-4">
				<h3 class="text-lg font-bold text-white">Change User Password</h3>
			</div>
			<form method="POST" action="?/changePassword" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						closePasswordModal();
					}
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
