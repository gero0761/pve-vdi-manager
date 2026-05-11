<script lang="ts">
	import { enhance } from '$app/forms';
	import SpinningCircle from '$lib/components/SpinningCircle.svelte';
	let { data, form } = $props();

	let searchTerm = $state('');
	let filteredGroups = $derived(
		data.availableGroups.filter((g: any) => 
			g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			g.id.toLowerCase().includes(searchTerm.toLowerCase())
		)
	);

	let showDropdown = $state(false);
	let isAddingGroup = $state(false);
	let processingGroupId = $state<string | null>(null);

	function selectGroup(id: string, name: string) {
		searchTerm = name;
		showDropdown = false;
	}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<header class="mb-10 flex items-center justify-between">
		<div class="flex items-center gap-4">
			<a href="/mgmt/users" class="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<div>
				<h1 class="text-3xl font-extrabold tracking-tight text-white">Manage User: {data.targetUser.username}</h1>
				<p class="mt-2 text-sm text-gray-400">Manage group memberships and view inherited access.</p>
			</div>
		</div>
	</header>

	{#if form?.error}
		<div class="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400">
			{form.error}
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
		<!-- User Info Sidebar -->
		<div class="lg:col-span-1 space-y-6">
			<div class="rounded-2xl border border-gray-800 bg-gray-800 p-6 shadow-xl">
				<h3 class="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">User Profile</h3>
				<div class="space-y-4">
					<div>
						<span class="block text-[10px] font-black uppercase tracking-widest text-gray-600">Full Name</span>
						<p class="text-gray-200 mt-1 font-bold">{data.targetUser.first_name} {data.targetUser.last_name}</p>
					</div>
					<div>
						<span class="block text-[10px] font-black uppercase tracking-widest text-gray-600">Username</span>
						<p class="text-gray-200 mt-1 font-mono">{data.targetUser.username}</p>
					</div>
					<div>
						<span class="block text-[10px] font-black uppercase tracking-widest text-gray-600">Role</span>
						<span class="mt-2 inline-block rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-tight {data.targetUser.role === 'admin' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-gray-900 text-gray-400 border border-gray-700'}">
							{data.targetUser.role}
						</span>
					</div>
				</div>
			</div>

			<div class="rounded-2xl border border-gray-800 bg-gray-800 p-6 shadow-xl">
				<h3 class="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Inherited Access</h3>
				<p class="text-[10px] text-gray-500 mb-4 italic">Instances accessible via groups.</p>
				<div class="space-y-3">
					{#each data.instanceWithSources as inst (inst.vmid)}
						<div class="rounded-lg bg-gray-900 p-3 border border-gray-700">
							<div class="flex items-center gap-2 mb-1.5">
								<div class="h-2 w-2 rounded-full bg-emerald-500"></div>
								<span class="text-xs font-bold text-gray-200">VM {inst.vmid}</span>
							</div>
							<div class="flex flex-wrap gap-1">
								{#each inst.sources as source (source.groupId + source.permissionName)}
									<span class="inline-flex items-center rounded bg-gray-800 px-1.5 py-0.5 text-[9px] text-gray-400 border border-gray-700">
										via <a href="/mgmt/groups/{source.groupId}" class="mx-1 font-bold text-amber-500/80 hover:text-amber-400 transition-colors">{source.groupName}</a> ({source.permissionName})
									</span>
								{/each}
							</div>
						</div>
					{:else}
						<p class="text-xs text-gray-600 text-center py-4 italic">No access granted.</p>
					{/each}
				</div>
			</div>
		</div>

		<!-- Group Management Section -->
		<div class="lg:col-span-2 space-y-8">
			<!-- Add Group Form -->
			<div class="rounded-2xl border border-gray-800 bg-gray-800 p-8 shadow-xl">
				<h3 class="text-lg font-bold text-white mb-6 flex items-center gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					Add to Group
				</h3>

				<form method="POST" action="?/addGroup" use:enhance={() => {
					isAddingGroup = true;
					return async ({ update }) => {
						searchTerm = '';
						isAddingGroup = false;
						await update();
					};
				}} class="relative">
					<div class="flex gap-4">
						<div class="relative flex-1">
							<input
								type="text"
								placeholder="Search groups..."
								bind:value={searchTerm}
								onfocus={() => showDropdown = true}
								onblur={() => setTimeout(() => showDropdown = false, 200)}
								required
								disabled={isAddingGroup}
								autocomplete="off"
								class="w-full rounded-xl border-gray-700 bg-gray-900 py-3 px-4 text-gray-200 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all disabled:opacity-50"
							/>
							
							{#if showDropdown && filteredGroups.length > 0}
								<div class="absolute left-0 right-0 z-10 mt-2 max-h-60 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
									{#each filteredGroups as group (group.id)}
										<button
											type="button"
											onclick={() => {
												selectGroup(group.id, group.name);
												const input = document.getElementById('hiddenGroupId') as HTMLInputElement;
												if(input) input.value = group.id;
											}}
											class="flex w-full flex-col px-4 py-3 text-left hover:bg-amber-600/10 transition-colors border-b border-gray-800 last:border-0"
										>
											<span class="font-bold text-gray-200 text-sm">{group.name}</span>
											<span class="text-[10px] text-gray-500">{group.description || 'No description'}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
						<input type="hidden" name="groupId" id="hiddenGroupId" />
						<button type="submit" disabled={isAddingGroup} class="rounded-xl bg-amber-600 px-8 py-3 font-bold text-white shadow-lg shadow-amber-600/30 hover:bg-amber-500 transition-all disabled:opacity-50 min-w-[160px] flex justify-center items-center gap-2">
							{#if isAddingGroup}
								<SpinningCircle size="h-5 w-5" color="text-white" />
								Adding...
							{:else}
								Add to Group
							{/if}
						</button>
					</div>
				</form>
			</div>

			<!-- Current Groups List -->
			<div class="rounded-2xl border border-gray-800 bg-gray-800 shadow-xl overflow-hidden ring-1 ring-white/5">
				<div class="border-b border-gray-700 bg-gray-800/50 px-8 py-5">
					<h3 class="text-lg font-bold text-white">Groups & Memberships</h3>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm whitespace-nowrap">
						<thead>
							<tr class="bg-gray-900/50 text-[11px] font-bold uppercase tracking-widest text-gray-500">
								<th class="px-8 py-4">Group Name</th>
								<th class="px-8 py-4">Type</th>
								<th class="px-8 py-4 text-right">Action</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-700/50">
							{#each data.userGroups as group (group.id)}
								<tr class="transition-all hover:bg-white/1">
									<td class="px-8 py-4">
										<div class="flex flex-col">
											<a href="/mgmt/groups/{group.id}" class="font-bold hover:underline {group.isDirect ? 'text-amber-400' : 'text-gray-400'}">{group.name}</a>
											<span class="text-[10px] text-gray-500 font-mono">{group.id}</span>
										</div>
									</td>
									<td class="px-8 py-4">
										{#if group.isDirect}
											<span class="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-amber-400 border border-amber-500/20">
												Direct Member
											</span>
										{:else}
											<span class="rounded-full bg-gray-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-gray-500 border border-gray-500/20">
												Inherited
											</span>
										{/if}
									</td>
									<td class="px-8 py-4 text-right">
										{#if group.isDirect}
											<form method="POST" action="?/removeGroup" use:enhance={() => {
												processingGroupId = group.id;
												return async ({ update }) => {
													processingGroupId = null;
													await update();
												};
											}}>
												<input type="hidden" name="groupId" value={group.id} />
												<button 
													type="submit" 
													disabled={!!processingGroupId} 
													class="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white shadow-lg shadow-red-500/5 transition-all disabled:opacity-50 flex items-center gap-2"
												>
													{#if processingGroupId === group.id}
														<SpinningCircle size="h-3 w-3" color="text-red-400" />
													{/if}
													Remove
												</button>
											</form>
										{:else}
											<span class="text-[10px] text-gray-600 italic">Managed via nesting</span>
										{/if}
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="3" class="px-8 py-10 text-center text-gray-500 italic">
										User is not a member of any group.
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
