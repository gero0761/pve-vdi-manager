<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();

	let searchTerm = $state('');
	let filteredInstances = $derived(
		data.availableInstances.filter((inst: any) => 
			inst.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
			inst.vmid.toString().includes(searchTerm)
		)
	);

	let showDropdown = $state(false);

	function selectInstance(id: string) {
		searchTerm = id;
		showDropdown = false;
	}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<header class="mb-10 flex items-center justify-between">
		<div class="flex items-center gap-4">
			<a href="/mgmt/users" aria-label="Back to User List" title="Back to User List" class="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<div>
				<h1 class="text-3xl font-extrabold tracking-tight text-white">Manage Access: {data.targetUser.username}</h1>
				<p class="mt-2 text-sm text-gray-400">Assign or remove VDI instances for this user.</p>
			</div>
		</div>
	</header>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
		<!-- User Info Sidebar -->
		<div class="lg:col-span-1">
			<div class="rounded-2xl border border-gray-800 bg-gray-800 p-6 shadow-2xl">
				<h3 class="text-lg font-bold text-white mb-4">User Profile</h3>
				<div class="space-y-4">
					<div>
						<span class="block text-xs font-bold text-gray-500 uppercase tracking-widest">Full Name</span>
						<p class="text-gray-200 mt-1">{data.targetUser.first_name} {data.targetUser.last_name}</p>
					</div>
					<div>
						<span class="block text-xs font-bold text-gray-500 uppercase tracking-widest">Username</span>
						<p class="text-gray-200 mt-1 font-mono">{data.targetUser.username}</p>
					</div>
					<div>
						<span class="block text-xs font-bold text-gray-500 uppercase tracking-widest">Role</span>
						<span class="mt-2 inline-block rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-tight {data.targetUser.role === 'admin' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-gray-900 text-gray-400 border border-gray-700'}">
							{data.targetUser.role}
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Instance Assignment Section -->
		<div class="lg:col-span-2 space-y-8">
			<!-- Add Instance Form -->
			<div class="rounded-2xl border border-gray-800 bg-gray-800 p-8 shadow-2xl">
				<h3 class="text-lg font-bold text-white mb-6 flex items-center gap-2">
					<svg class="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
					</svg>
					Assign New Instance
				</h3>

				<form method="POST" action="?/assign" use:enhance={() => {
					return async ({ result, update }) => {
						searchTerm = '';
						await update();
					};
				}} class="relative">
					<div class="flex gap-4">
						<div class="relative flex-1">
							<input
								type="text"
								name="instanceId"
								placeholder="Search by Instance ID or VMID..."
								bind:value={searchTerm}
								onfocus={() => showDropdown = true}
								onblur={() => setTimeout(() => showDropdown = false, 200)}
								required
								autocomplete="off"
								class="w-full rounded-xl border-gray-700 bg-gray-900 py-3 px-4 text-gray-200 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
							/>
							
							{#if showDropdown && filteredInstances.length > 0}
								<div class="absolute left-0 right-0 z-10 mt-2 max-h-60 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
									{#each filteredInstances as inst (inst.id)}
										<button
											type="button"
											onclick={() => selectInstance(inst.id)}
											class="flex w-full flex-col px-4 py-3 text-left hover:bg-indigo-600/10 transition-colors border-b border-gray-800 last:border-0"
										>
											<span class="font-mono text-sm font-bold text-gray-200">{inst.id}</span>
											<span class="text-xs text-gray-500">VMID: {inst.vmid} | {inst.type.toUpperCase()} | {inst.node}</span>
										</button>
									{/each}
								</div>
							{:else if showDropdown && searchTerm.length > 0}
								<div class="absolute left-0 right-0 z-10 mt-2 rounded-xl border border-gray-700 bg-gray-900 p-4 text-center text-sm text-gray-500 shadow-2xl">
									No matching instances found.
								</div>
							{/if}
						</div>
						<button type="submit" class="rounded-xl bg-indigo-600 px-8 py-3 font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all">
							Assign
						</button>
					</div>
				</form>
			</div>

			<!-- Assigned Instances List -->
			<div class="rounded-2xl border border-gray-800 bg-gray-800 shadow-2xl ring-1 ring-white/5">
				<div class="border-b border-gray-700 bg-gray-800/50 px-8 py-5">
					<h3 class="text-lg font-bold text-white">Currently Assigned</h3>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm whitespace-nowrap">
						<thead>
							<tr class="bg-gray-900/50 text-[11px] font-bold uppercase tracking-widest text-gray-500">
								<th class="px-8 py-4">Instance ID</th>
								<th class="px-8 py-4">VMID</th>
								<th class="px-8 py-4 text-right">Action</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-700/50">
							{#each data.assignedInstances as inst (inst.id)}
								<tr class="transition-all hover:bg-white/1">
									<td class="px-8 py-4 font-mono text-indigo-400 font-bold">{inst.id}</td>
									<td class="px-8 py-4 text-gray-400">{inst.vmid}</td>
									<td class="px-8 py-4 text-right">
										<form method="POST" action="?/remove" use:enhance>
											<input type="hidden" name="instanceId" value={inst.id} />
											<button type="submit" class="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all">
												Remove
											</button>
										</form>
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="3" class="px-8 py-10 text-center text-gray-500 italic">
										No instances assigned to this user yet.
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</div>
