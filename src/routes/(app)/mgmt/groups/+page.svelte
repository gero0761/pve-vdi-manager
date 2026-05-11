<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import SpinningCircle from '$lib/components/SpinningCircle.svelte';
	let { data, form } = $props();

	let showCreateModal = $state(false);
	let activeTab = $state('standard');
	let selectedInstances = $state<string[]>([]);
	let searchQuery = $state('');

	let confirmState = $state({
		isOpen: false,
		title: '',
		message: '',
		onConfirm: () => {},
		onCancel: () => { confirmState.isOpen = false; }
	});

	const filteredInstances = $derived(
		data.instances?.filter(i => 
			i.vmid.toString().includes(searchQuery) || 
			i.id.toLowerCase().includes(searchQuery.toLowerCase())
		) || []
	);

	function toggleInstance(id: string) {
		if (selectedInstances.includes(id)) {
			selectedInstances = selectedInstances.filter(i => i !== id);
		} else {
			selectedInstances = [...selectedInstances, id];
		}
	}

	function triggerQuickCreate() {
		const type = (document.querySelector('input[name="permissionType"]:checked') as HTMLInputElement)?.value;
		if (!type) return;

		confirmState = {
			...confirmState,
			isOpen: true,
			title: 'Confirm Batch Creation',
			message: `You are about to create ${selectedInstances.length} groups with <b>"${type}"</b> permissions. Do you want to proceed?`,
			onConfirm: () => {
				const form = document.getElementById('quickCreateForm') as HTMLFormElement;
				form.requestSubmit();
				confirmState.isOpen = false;
			}
		};
	}
	let isLoading = $state(false);
	let deletingGroupId = $state<string | null>(null);
	let selectedGroups = $state<string[]>([]);

	const allSelectableGroups = $derived(data.groups.filter(g => !g.isProtected).map(g => g.id));
	const isAllSelected = $derived(selectedGroups.length > 0 && selectedGroups.length === allSelectableGroups.length);

	function toggleAllGroups() {
		if (isAllSelected) {
			selectedGroups = [];
		} else {
			selectedGroups = allSelectableGroups;
		}
	}

	function toggleGroupSelection(id: string) {
		if (selectedGroups.includes(id)) {
			selectedGroups = selectedGroups.filter(gid => gid !== id);
		} else {
			selectedGroups = [...selectedGroups, id];
		}
	}

	function triggerBulkDelete() {
		confirmState = {
			...confirmState,
			isOpen: true,
			title: 'Bulk Delete Groups',
			message: `Are you sure you want to delete <b>${selectedGroups.length}</b> selected groups? This action cannot be undone.`,
			onConfirm: () => {
				const form = document.getElementById('bulkDeleteForm') as HTMLFormElement;
				form.requestSubmit();
				confirmState.isOpen = false;
			}
		};
	}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<header class="mb-10 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight text-white">Group Management</h1>
			<p class="mt-2 text-sm text-gray-400">Manage user groups and access permissions.</p>
		</div>
		<button 
			onclick={() => {
				showCreateModal = true;
				activeTab = 'standard';
				selectedInstances = [];
			}}
			disabled={isLoading || !!deletingGroupId}
			class="rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-600/20 hover:bg-amber-500 transition-all disabled:opacity-50"
		>
			Create Group
		</button>
	</header>

	{#if selectedGroups.length > 0}
		<div class="mb-6 flex items-center justify-between rounded-2xl border border-red-500/30 bg-red-500/10 p-4 shadow-lg shadow-red-500/5 animate-in slide-in-from-top-4 duration-300">
			<div class="flex items-center gap-3">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-sm font-bold text-white">
					{selectedGroups.length}
				</div>
				<span class="text-sm font-bold text-red-400">Groups selected for deletion</span>
			</div>
			<form id="bulkDeleteForm" method="POST" action="?/bulkDelete" use:enhance={() => {
				isLoading = true;
				return async ({ result, update }) => {
					isLoading = false;
					await update();
					if (result.type === 'success') selectedGroups = [];
				};
			}}>
				{#each selectedGroups as id (id)}
					<input type="hidden" name="ids" value={id} />
				{/each}
				<button 
					type="button" 
					onclick={triggerBulkDelete}
					disabled={isLoading}
					class="rounded-xl bg-red-600 px-6 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-500 transition-all flex items-center gap-2"
				>
					{#if isLoading}
						<SpinningCircle size="h-3 w-3" color="text-white" />
						Deleting...
					{:else}
						Delete Selected
					{/if}
				</button>
			</form>
		</div>
	{/if}

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
						<th class="px-6 py-5 w-10">
							<input 
								type="checkbox" 
								checked={isAllSelected}
								onchange={toggleAllGroups}
								class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-amber-500 focus:ring-0 cursor-pointer"
							/>
						</th>
						<th class="px-8 py-5">Group Name</th>
						<th class="px-8 py-5">Description</th>
						<th class="px-8 py-5">Status</th>
						<th class="px-8 py-5 text-right">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-700/50">
					{#each data.groups as group (group.id)}
						<tr class="transition-all hover:bg-white/2 {selectedGroups.includes(group.id) ? 'bg-amber-500/5' : ''}">
							<td class="px-6 py-4">
								<input 
									type="checkbox" 
									checked={selectedGroups.includes(group.id)}
									onchange={() => toggleGroupSelection(group.id)}
									disabled={group.isProtected || isLoading}
									class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-amber-500 focus:ring-0 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
								/>
							</td>
							<td class="px-8 py-4">
								<div class="flex flex-col">
									<a href="/mgmt/groups/{group.id}" class="font-bold text-gray-200 hover:text-amber-400 transition-colors">
										{group.name}
									</a>
									<span class="text-xs text-gray-500 font-mono">{group.id}</span>
								</div>
							</td>
							<td class="px-8 py-4 text-gray-400 max-w-xs truncate">
								{group.description || 'No description'}
							</td>
							<td class="px-8 py-4">
								{#if group.isProtected}
									<span class="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-blue-400 border border-blue-500/20">
										System / Protected
									</span>
								{:else}
									<span class="rounded-full bg-gray-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-gray-500 border border-gray-500/20">
										Manual
									</span>
								{/if}
							</td>
							<td class="px-8 py-4 text-right">
								<div class="flex items-center justify-end gap-3">
									<a href="/mgmt/groups/{group.id}" class="rounded-lg bg-indigo-600/10 px-3 py-1.5 text-xs font-bold text-indigo-400 border border-indigo-600/20 hover:bg-indigo-600 hover:text-white transition-all">
										Members & Perms
									</a>
									<form method="POST" action="?/delete" use:enhance={() => {
										deletingGroupId = group.id;
										return async ({ update }) => {
											await update();
											deletingGroupId = null;
										};
									}}>
										<input type="hidden" name="id" value={group.id} />
										<button 
											type="submit" 
											class="rounded-lg bg-red-600/10 px-3 py-1.5 text-xs font-bold text-red-400 border border-red-600/20 hover:bg-red-600 hover:text-white transition-all disabled:opacity-10 min-w-[70px] flex justify-center" 
											disabled={group.isProtected || !!deletingGroupId}
											title={group.isProtected ? "Cannot delete system groups" : ""}
										>
											{#if deletingGroupId === group.id}
												<SpinningCircle size="h-4 w-4" color="text-red-400" />
											{:else}
												Delete
											{/if}
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

{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
		<div class="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl">
			<!-- Modal Header with Tabs -->
			<div class="border-b border-gray-700 bg-gray-800/50">
				<div class="flex">
					<button 
						onclick={() => activeTab = 'standard'}
						class="flex-1 px-6 py-4 text-sm font-bold transition-all {activeTab === 'standard' ? 'bg-gray-700 text-white border-b-2 border-amber-500' : 'text-gray-400 hover:text-gray-200'}"
					>
						Standard Group
					</button>
					<button 
						onclick={() => activeTab = 'wizard'}
						class="flex-1 px-6 py-4 text-sm font-bold transition-all {activeTab === 'wizard' ? 'bg-gray-700 text-white border-b-2 border-amber-500' : 'text-gray-400 hover:text-gray-200'}"
					>
						Quick Wizard
					</button>
				</div>
			</div>

			{#if activeTab === 'standard'}
				<form method="POST" action="?/create" use:enhance={() => {
					isLoading = true;
					return async ({ result, update }) => {
						isLoading = false;
						await update({ reset: result.type === 'success' });
						if (result.type === 'success') showCreateModal = false;
					};
				}} class="p-6">
					<div class="space-y-4">
						<div class="space-y-2">
							<label for="name" class="block text-xs font-bold text-gray-400 uppercase tracking-tight">Group Name</label>
							<input type="text" id="name" name="name" required placeholder="e.g. Finance Team" class="w-full rounded-xl border-gray-700 bg-gray-900 py-2.5 px-4 text-gray-200 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 placeholder:text-gray-600" />
						</div>
						<div class="space-y-2">
							<label for="description" class="block text-xs font-bold text-gray-400 uppercase tracking-tight">Description</label>
							<textarea id="description" name="description" rows="3" placeholder="Explain the purpose of this group..." class="w-full rounded-xl border-gray-700 bg-gray-900 py-2.5 px-4 text-gray-200 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 placeholder:text-gray-600"></textarea>
						</div>
					</div>
					<div class="mt-8 flex gap-3">
						<button type="button" onclick={() => showCreateModal = false} disabled={isLoading} class="flex-1 rounded-xl bg-gray-700 py-3 font-bold text-white hover:bg-gray-600 transition-all disabled:opacity-50">Cancel</button>
						<button type="submit" disabled={isLoading} class="flex-1 rounded-xl bg-amber-600 py-3 font-bold text-white shadow-lg shadow-amber-600/30 hover:bg-amber-500 transition-all disabled:opacity-50">
							{#if isLoading}
								<span class="flex items-center justify-center gap-2">
									<SpinningCircle size="h-4 w-4" color="text-white" />
									Creating...
								</span>
							{:else}
								Create Group
							{/if}
						</button>
					</div>
				</form>
			{:else}
				<form id="quickCreateForm" method="POST" action="?/quickCreate" use:enhance={() => {
					isLoading = true;
					return async ({ result, update }) => {
						isLoading = false;
						await update({ reset: result.type === 'success' });
						if (result.type === 'success') {
							showCreateModal = false;
							selectedInstances = [];
						}
					};
				}} class="p-6">
					<div class="space-y-6">
						<div class="space-y-3">
							<label class="block text-xs font-bold text-gray-400 uppercase tracking-tight">1. Select Instances ({selectedInstances.length})</label>
							<div class="relative">
								<input 
									type="text" 
									bind:value={searchQuery}
									placeholder="Search VMID or ID..." 
									disabled={isLoading}
									class="w-full rounded-t-xl border-b border-gray-700 bg-gray-900 py-2.5 px-4 text-sm text-gray-200 focus:outline-none focus:ring-0 placeholder:text-gray-600 disabled:opacity-50"
								/>
								<div class="max-h-48 overflow-y-auto rounded-b-xl border border-gray-700 bg-gray-900/50">
									{#each filteredInstances as inst (inst.id)}
										<label class="flex items-center gap-3 px-4 py-2 hover:bg-white/5 cursor-pointer transition-colors {isLoading ? 'pointer-events-none opacity-50' : ''}">
											<input 
												type="checkbox" 
												name="instanceIds" 
												value={inst.id}
												checked={selectedInstances.includes(inst.id)}
												onchange={() => toggleInstance(inst.id)}
												disabled={isLoading}
												class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-amber-500 focus:ring-0"
											/>
											<span class="text-sm font-medium text-gray-300">VM {inst.vmid}</span>
											<span class="text-[10px] text-gray-500 font-mono">{inst.id}</span>
										</label>
									{:else}
										<div class="px-4 py-8 text-center text-xs text-gray-600">No instances found</div>
									{/each}
								</div>
							</div>
						</div>

						<div class="space-y-3">
							<label class="block text-xs font-bold text-gray-400 uppercase tracking-tight">2. Select Permission Type</label>
							<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
								{#each data.permissionTypes as pt (pt.id)}
									<label class="relative flex flex-col items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/50 p-3 cursor-pointer hover:bg-gray-700 transition-all group {isLoading ? 'pointer-events-none opacity-50' : ''}">
										<input type="radio" name="permissionType" value={pt.name} required disabled={isLoading} class="peer hidden" />
										<div class="absolute inset-0 rounded-xl border-2 border-transparent peer-checked:border-amber-500 transition-all"></div>
										<span class="text-[10px] font-bold uppercase tracking-tight text-gray-400 peer-checked:text-white group-hover:text-gray-200">{pt.name}</span>
									</label>
								{/each}
							</div>
						</div>

						{#if selectedInstances.length > 0}
							<div class="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3">
								<p class="text-[10px] font-bold text-amber-500/60 uppercase tracking-widest mb-2">Summary</p>
								<p class="text-xs text-gray-400">
									Will create {selectedInstances.length} groups and link them to their respective instances.
								</p>
							</div>
						{/if}
					</div>
					<div class="mt-8 flex gap-3">
						<button type="button" onclick={() => showCreateModal = false} disabled={isLoading} class="flex-1 rounded-xl bg-gray-700 py-3 font-bold text-white hover:bg-gray-600 transition-all disabled:opacity-50">Cancel</button>
						<button 
							type="button" 
							onclick={triggerQuickCreate}
							disabled={selectedInstances.length === 0 || isLoading}
							class="flex-1 rounded-xl bg-amber-600 py-3 font-bold text-white shadow-lg shadow-amber-600/30 hover:bg-amber-500 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
						>
							{#if isLoading}
								<span class="flex items-center justify-center gap-2">
									<SpinningCircle size="h-4 w-4" color="text-white" />
									Generating...
								</span>
							{:else}
								Generate Groups
							{/if}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}

<ConfirmDialog {...confirmState} />
