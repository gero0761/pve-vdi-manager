<script lang="ts">
	import SpinningCircle from './SpinningCircle.svelte';

	export interface Template {
		vmid: number;
		name: string;
		node: string;
		type: 'qemu' | 'lxc';
	}

	export interface Group {
		id: string;
		name: string;
		description: string;
		type_id: number;
		is_protected: boolean;
		users: string[]; // User IDs
	}

	export interface User {
		id: string;
		username: string;
		first_name: string;
		last_name: string;
	}

	export interface PermissionType {
		id: number;
		name: string;
		description: string;
	}

	interface Instance {
		id: string;
		vmid: number;
		type: string;
		node: string;
		created_at: number;
		status?: 'running' | 'stopped' | 'unknown' | 'loading';
		ip?: string | null;
		sync_status?: string;
	}

	interface Props {
		isOpen: boolean;
		templates: Template[];
		isLoadingTemplates?: boolean;
		templateError?: string;
		groups: Group[];
		users: User[];
		permissionTypes: PermissionType[];
		isLoadingData?: boolean;
		onClose: () => void;
		onDeployed: (clones: Instance[]) => void;
	}

	let {
		isOpen = false,
		templates = [],
		isLoadingTemplates = false,
		templateError = '',
		groups = [],
		users = [],
		permissionTypes = [],
		isLoadingData = false,
		onClose,
		onDeployed
	}: Props = $props();

	let activeTab = $state<'single' | 'assigned'>('single');
	let selectedTemplateIndex = $state(0);
	let count = $state(1);

	// Assigned Provisioning state
	let selectedGroupId = $state<string>('');
	let selectedUsers = $state<Record<string, boolean>>({});
	let userPermissions = $state<Record<string, number>>({});

	let isDeploying = $state(false);
	let statusMessage = $state('');
	let error = $state('');

	// Select first non-protected group by default when groups are loaded
	$effect(() => {
		if (isOpen && groups.length > 0 && !selectedGroupId) {
			const defaultGrp = groups.find((g) => !g.is_protected) || groups[0];
			selectedGroupId = defaultGrp ? defaultGrp.id : '';
		}
	});

	// Initialize select state when group changes
	$effect(() => {
		if (selectedGroupId) {
			const group = groups.find((g) => g.id === selectedGroupId);
			if (group) {
				const nextSelected: Record<string, boolean> = {};
				const nextPerms: Record<string, number> = {};
				// Default permission type id (all has ID 1 usually)
				const defaultPermId = permissionTypes.find((p) => p.name === 'all')?.id || 1;

				group.users.forEach((userId) => {
					nextSelected[userId] = true;
					nextPerms[userId] = defaultPermId;
				});

				selectedUsers = nextSelected;
				userPermissions = nextPerms;
			}
		}
	});

	const groupUsers = $derived.by(() => {
		if (!selectedGroupId) return [];
		const group = groups.find((g) => g.id === selectedGroupId);
		if (!group) return [];
		return users.filter((u) => group.users.includes(u.id));
	});

	const selectedCount = $derived(
		Object.values(selectedUsers).filter(Boolean).length
	);

	async function handleDeploySingle() {
		if (templates.length === 0) return;
		const template = templates[selectedTemplateIndex];

		isDeploying = true;
		error = '';
		statusMessage = `Cloning ${count} instance(s) from template ${template.name}...`;

		try {
			const res = await fetch('/api/pve/clone', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					template_vmid: template.vmid,
					template_name: template.name,
					template_node: template.node,
					template_type: template.type,
					count
				})
			});
			const data = await res.json();

			if (data.error) {
				error = data.error;
			} else {
				onDeployed(data.clones || []);
				onClose();
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			isDeploying = false;
			statusMessage = '';
		}
	}

	async function handleDeployAssigned() {
		if (templates.length === 0) return;
		const template = templates[selectedTemplateIndex];
		const targets = groupUsers.filter((u) => selectedUsers[u.id]);

		if (targets.length === 0) {
			error = 'Please select at least one user for provisioning.';
			return;
		}

		isDeploying = true;
		error = '';
		statusMessage = `Bulk cloning and provisioning ${targets.length} instance(s)...`;

		try {
			const deployments = targets.map((u) => ({
				userId: u.id,
				permissionTypeId: userPermissions[u.id]
			}));

			const res = await fetch('/api/pve/assigned-deploy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					template_vmid: template.vmid,
					template_name: template.name,
					template_node: template.node,
					template_type: template.type,
					deployments
				})
			});

			const data = await res.json();

			if (data.error) {
				throw new Error(data.error);
			}

			onDeployed(data.clones || []);
			onClose();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			isDeploying = false;
			statusMessage = '';
		}
	}

	function handleToggleAll(e: Event) {
		const checked = (e.target as HTMLInputElement).checked;
		const nextSelected = { ...selectedUsers };
		groupUsers.forEach((u) => {
			nextSelected[u.id] = checked;
		});
		selectedUsers = nextSelected;
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-200">
		<div class="w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-700 bg-gray-800 shadow-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
			<!-- Header -->
			<div class="bg-gray-850 px-6 py-4 border-b border-gray-700 flex justify-between items-center shrink-0">
				<div>
					<h3 class="text-lg font-bold text-white">Deploy Instance</h3>
					<p class="text-xs text-gray-400 font-medium">Provision template-based virtual environments.</p>
				</div>
				<button onclick={onClose} disabled={isDeploying} class="text-gray-400 hover:text-white transition disabled:opacity-50" aria-label="Close">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Tabs -->
			<div class="flex border-b border-gray-700 bg-gray-900/30 px-6 py-2 gap-4 shrink-0">
				<button 
					onclick={() => !isDeploying && (activeTab = 'single')}
					disabled={isDeploying}
					class="px-4 py-2 text-sm font-black uppercase tracking-wider transition-all border-b-2 {activeTab === 'single' ? 'text-indigo-400 border-indigo-400' : 'text-gray-400 border-transparent hover:text-gray-200'} disabled:opacity-50"
				>
					Single / Bulk
				</button>
				<button 
					onclick={() => !isDeploying && (activeTab = 'assigned')}
					disabled={isDeploying}
					class="px-4 py-2 text-sm font-black uppercase tracking-wider transition-all border-b-2 {activeTab === 'assigned' ? 'text-indigo-400 border-indigo-400' : 'text-gray-400 border-transparent hover:text-gray-200'} disabled:opacity-50"
				>
					Assigned Provisioning
				</button>
			</div>

			<!-- Scrollable Content -->
			<div class="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
				{#if isLoadingTemplates}
					<div class="flex flex-col justify-center items-center py-12 gap-3">
						<SpinningCircle size="h-8 w-8" color="text-indigo-500" />
						<span class="text-sm font-medium text-gray-400">Scanning Proxmox for templates...</span>
					</div>
				{:else if templateError}
					<div class="rounded-xl border border-red-500/50 bg-red-500/10 p-6 font-medium text-red-400 shadow-xl">
						<div class="flex items-center gap-3">
							<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<span>Proxmox Error: {templateError}</span>
						</div>
					</div>
				{:else if templates.length === 0}
					<div class="space-y-6 rounded-2xl border-2 border-dashed border-gray-700 bg-gray-800/30 p-16 text-center shadow-2xl">
						<svg class="mx-auto h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
						</svg>
						<div class="space-y-2">
							<h3 class="text-2xl font-bold text-white">No Templates Found</h3>
							<p class="mx-auto max-w-lg leading-relaxed text-gray-400">
								We could not find any VM or LXC templates on your Proxmox cluster. Please log into Proxmox and convert an existing VM to a template.
							</p>
						</div>
					</div>
				{:else}
					<!-- Template Selection (used for both tabs) -->
					<div class="space-y-2">
						<label for="modal-template-select" class="block text-xs font-black uppercase tracking-widest text-gray-400">Source Template</label>
						<select
							id="modal-template-select"
							bind:value={selectedTemplateIndex}
							disabled={isDeploying}
							class="w-full rounded-xl border-gray-700 bg-gray-900 py-2.5 pr-10 pl-4 text-gray-200 shadow-sm transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
						>
							{#each templates as t, i (t.vmid)}
								<option value={i}>{t.name} (VMID: {t.vmid}, {t.type.toUpperCase()}, {t.node})</option>
							{/each}
						</select>
					</div>

					{#if activeTab === 'single'}
						<!-- Single / Bulk Deploy Form -->
						<div class="space-y-2 max-w-xs animate-in fade-in duration-200">
							<label for="modal-instance-count" class="block text-xs font-black uppercase tracking-widest text-gray-400">Deployment Count</label>
							<input
								id="modal-instance-count"
								type="number"
								min="1"
								max="50"
								bind:value={count}
								disabled={isDeploying}
								class="w-full rounded-xl border-gray-700 bg-gray-900 py-2.5 text-center text-gray-200 shadow-sm transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
							/>
						</div>
					{:else}
						<!-- Assigned Provisioning Form -->
						<div class="space-y-6 animate-in fade-in duration-200">
							{#if isLoadingData}
								<div class="flex flex-col justify-center items-center py-12 gap-3">
									<SpinningCircle size="h-8 w-8" color="text-indigo-500" />
									<span class="text-sm font-medium text-gray-400">Loading user groups...</span>
								</div>
							{:else}
								<div class="space-y-2">
									<label for="modal-group-select" class="block text-xs font-black uppercase tracking-widest text-gray-400">Target Group</label>
									<select
										id="modal-group-select"
										bind:value={selectedGroupId}
										disabled={isDeploying}
										class="w-full rounded-xl border-gray-700 bg-gray-900 py-2.5 pr-10 pl-4 text-gray-200 shadow-sm transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
									>
										<option value="" disabled>Select a user group...</option>
										{#each groups as g (g.id)}
											<option value={g.id}>{g.name} ({g.users.length} users) {g.is_protected ? '[System]' : ''}</option>
										{/each}
									</select>
								</div>

								{#if selectedGroupId}
									<div class="space-y-3">
										<div class="flex justify-between items-center">
											<h4 class="text-xs font-black uppercase tracking-widest text-gray-400">Assign Permissions per User</h4>
											<span class="text-xs font-semibold text-indigo-400">{selectedCount} of {groupUsers.length} selected</span>
										</div>

										<div class="border border-gray-700 bg-gray-900/40 rounded-2xl overflow-hidden">
											<div class="max-h-60 overflow-y-auto custom-scrollbar">
												<table class="w-full text-left border-collapse">
													<thead>
														<tr class="border-b border-gray-700 bg-gray-900/60 text-[10px] font-black uppercase tracking-wider text-gray-400">
															<th class="p-3 w-12 text-center">
																<input 
																	type="checkbox" 
																	checked={groupUsers.length > 0 && selectedCount === groupUsers.length} 
																	onchange={handleToggleAll} 
																	disabled={isDeploying}
																	class="rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
																/>
															</th>
															<th class="p-3">User</th>
															<th class="p-3 w-48">Permission Type</th>
														</tr>
													</thead>
													<tbody class="divide-y divide-gray-800">
														{#each groupUsers as user (user.id)}
															<tr class="hover:bg-white/2 transition text-sm text-gray-300">
																<td class="p-3 text-center">
																	<input 
																		type="checkbox" 
																		bind:checked={selectedUsers[user.id]} 
																		disabled={isDeploying}
																		class="rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
																	/>
																</td>
																<td class="p-3 font-medium">
																	<div>
																		<span class="text-white font-bold">{user.username}</span>
																		{#if user.first_name || user.last_name}
																			<span class="text-xs text-gray-500 ml-1">({user.first_name || ''} {user.last_name || ''})</span>
																		{/if}
																	</div>
																</td>
																<td class="p-3">
																	<select 
																		bind:value={userPermissions[user.id]} 
																		disabled={isDeploying || !selectedUsers[user.id]}
																		class="w-full rounded-lg border-gray-700 bg-gray-800 py-1 text-xs text-gray-200 focus:border-indigo-500 disabled:opacity-40"
																	>
																		{#each permissionTypes as pt (pt.id)}
																			<option value={pt.id}>{pt.name} - {pt.description}</option>
																		{/each}
																	</select>
																</td>
															</tr>
														{:else}
															<tr>
																<td colspan="3" class="p-8 text-center text-gray-500 italic text-xs">
																	This group has no user members.
																</td>
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
										</div>
									</div>
								{/if}
							{/if}
						</div>
					{/if}
				{/if}

				{#if error}
					<div class="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-medium text-red-400 animate-in fade-in duration-200">
						{error}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="bg-gray-900/50 px-6 py-4 flex items-center justify-between border-t border-gray-700 shrink-0">
				<div class="flex items-center gap-3">
					{#if isDeploying}
						<SpinningCircle size="h-5 w-5" color="text-indigo-400" />
						<span class="text-xs font-bold text-gray-400 animate-pulse">{statusMessage}</span>
					{/if}
				</div>
				<div class="flex gap-3">
					<button 
						onclick={onClose}
						disabled={isDeploying}
						class="rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-bold text-gray-300 hover:bg-gray-700 transition disabled:opacity-50"
					>
						Cancel
					</button>
					{#if activeTab === 'single'}
						<button 
							onclick={handleDeploySingle}
							disabled={isDeploying || templates.length === 0}
							class="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition disabled:opacity-50"
						>
							Deploy
						</button>
					{:else}
						<button 
							onclick={handleDeployAssigned}
							disabled={isDeploying || templates.length === 0 || selectedCount === 0}
							class="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition disabled:opacity-50"
						>
							Deploy to {selectedCount} User(s)
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.1);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(99, 102, 241, 0.2);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(99, 102, 241, 0.4);
	}
</style>
