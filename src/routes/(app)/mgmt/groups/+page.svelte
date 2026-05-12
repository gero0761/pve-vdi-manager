<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import SpinningCircle from '$lib/components/SpinningCircle.svelte';
	import type { UserGroup, GroupType, VDIInstance, PermissionType } from '$lib/server/db/types';

	interface Props {
		data: {
			groups: (UserGroup & { type: GroupType })[];
			groupTypes: GroupType[];
			instances: VDIInstance[];
			permissionTypes: PermissionType[];
		};
		form: any;
	}

	let { data, form }: Props = $props();

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

	// Protection check based on group type metadata
	const allSelectableGroups = $derived(data.groups.filter(g => !g.type?.is_protected).map(g => g.id));
	const isAllSelected = $derived(selectedGroups.length > 0 && selectedGroups.length === allSelectableGroups.length);


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
	const typeStyles: Record<number, string> = {
		0: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
		1: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
		2: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
		3: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
		4: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
		5: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
	};
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

	<DataTable
		columns={[
			{ label: 'Group Name', sortKey: 'name' },
			{ label: 'Description' },
			{ label: 'Type', sortKey: 'type.name' },
			{ label: 'Actions', class: 'text-right' }
		]}
		rows={data.groups}
		selectable
		selectedIds={selectedGroups}
		getRowId={(g) => g.id}
		{isAllSelected}
		onSelectAll={(checked) => checked ? (selectedGroups = allSelectableGroups) : (selectedGroups = [])}
		onSelectRow={(id) => toggleGroupSelection(id)}
		rowClass={(g) => selectedGroups.includes(g.id) ? 'bg-amber-500/5' : ''}
		emptyMessage="No groups have been created yet."
	>
		{#snippet row(group)}
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
				<span class="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight border {typeStyles[group.type_id] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}">
					{group.type?.name || 'Unknown'}
				</span>
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
							disabled={group.type?.is_protected || !!deletingGroupId}
							title={group.type?.is_protected ? 'Cannot delete system groups' : ''}
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
		{/snippet}
	</DataTable>
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
							<label for="type_id" class="block text-xs font-bold text-gray-400 uppercase tracking-tight">Group Type</label>
							<select id="type_id" name="type_id" class="w-full rounded-xl border-gray-700 bg-gray-900 py-2.5 px-4 text-gray-200 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20">
								{#each data.groupTypes?.filter(t => !t.is_protected) || [] as type (type.id)}
									<option value={type.id} selected={type.id === 2}>{type.name}</option>
								{/each}
							</select>
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
							<label class="block text-xs font-bold text-gray-400 uppercase tracking-tight" for="wizardSearch">1. Select Instances ({selectedInstances.length})</label>
							<div class="relative">
								<input 
									id="wizardSearch"
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
								<p class="text-[10px] font-bold text-amber-500/60 uppercase tracking-widest mb-2">Summary & Warning</p>
								<div class="space-y-2">
									<p class="text-xs text-gray-400">
										Will create <b>{selectedInstances.length}</b> groups of type <span class="text-blue-400 font-bold">"Permission"</span>.
									</p>
									<p class="text-[10px] text-red-400 font-bold leading-tight flex items-start gap-1.5">
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
										NOTICE: "Permission" type groups are system-protected and cannot be deleted once created.
									</p>
								</div>
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
