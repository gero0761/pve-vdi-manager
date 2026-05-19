<script lang="ts">
	import SpinningCircle from './SpinningCircle.svelte';

	interface Template {
		vmid: number;
		name: string;
		node: string;
		type: 'qemu' | 'lxc';
	}

	interface Group {
		id: string;
		name: string;
		description: string;
		type_id: number;
		is_protected: boolean;
		users: string[]; // User IDs
	}

	interface User {
		id: string;
		username: string;
		first_name: string;
		last_name: string;
	}

	interface PermissionType {
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
		onClose: () => void;
		onDeployed: (clones: Instance[]) => void;
	}

	let {
		isOpen = false,
		templates = [],
		onClose,
		onDeployed
	}: Props = $props();

	let activeTab = $state<'single' | 'assigned'>('single');
	let selectedTemplateIndex = $state(0);
	let count = $state(1);

	// Assigned Provisioning state
	let groups = $state<Group[]>([]);
	let users = $state<User[]>([]);
	let permissionTypes = $state<PermissionType[]>([]);
	let selectedGroupId = $state<string>('');
	let selectedUsers = $state<Record<string, boolean>>({});
	let userPermissions = $state<Record<string, number>>({});

	let isLoadingData = $state(false);
	let isDeploying = $state(false);
	let statusMessage = $state('');
	let error = $state('');

	// Fetch groups, users, and permission types on mount/open
	$effect(() => {
		if (isOpen) {
			fetchModalData();
		}
	});

	async function fetchModalData() {
		isLoadingData = true;
		error = '';
		try {
			const res = await fetch('/api/mgmt/groups');
			const data = await res.json();
			if (data.error) {
				error = data.error;
			} else {
				groups = data.groups || [];
				users = data.users || [];
				permissionTypes = data.permissionTypes || [];
				if (groups.length > 0) {
					// Exclude default system groups if possible, but let the user select
					// Select first non-protected group by default
					const defaultGrp = groups.find((g) => !g.is_protected) || groups[0];
					selectedGroupId = defaultGrp ? defaultGrp.id : '';
				}
			}
		} catch (e) {
			error = 'Failed to load group and user data';
			console.error(e);
		} finally {
			isLoadingData = false;
		}
	}

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
		const deployedClones: Instance[] = [];

		try {
			// Loop through selected users sequentially to provide rich status updates and avoid timeouts
			for (let i = 0; i < targets.length; i++) {
				const user = targets[i];
				const permissionTypeId = userPermissions[user.id];

				statusMessage = `[${i + 1}/${targets.length}] Cloning VM for student "${user.username}"...`;

				const res = await fetch('/api/pve/assigned-deploy', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						template_vmid: template.vmid,
						template_name: template.name,
						template_node: template.node,
						template_type: template.type,
						deployments: [{ userId: user.id, permissionTypeId }]
					})
				});

				const data = await res.json();

				if (data.error) {
					throw new Error(`Failed on student "${user.username}": ${data.error}`);
				}

				if (data.clones) {
					deployedClones.push(...data.clones);
				}
			}

			onDeployed(deployedClones);
			onClose();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			// Partial success is still possible, trigger refresh anyway
			if (deployedClones.length > 0) {
				onDeployed(deployedClones);
			}
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
				{#if isLoadingData}
					<div class="flex flex-col justify-center items-center py-12 gap-3">
						<SpinningCircle size="h-8 w-8" color="text-indigo-500" />
						<span class="text-sm font-medium text-gray-400">Loading user groups...</span>
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
