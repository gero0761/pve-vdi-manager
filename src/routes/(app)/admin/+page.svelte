<script lang="ts">
	import { onMount } from 'svelte';
	let { data } = $props();

	type Template = { vmid: number; name: string; node: string; type: 'qemu' | 'lxc' };
	type Instance = {
		id: string;
		vmid: number;
		type: string;
		node: string;
		created_at: number;
		status?: 'running' | 'stopped' | 'unknown' | 'loading';
		ip?: string | null;
	};

	let templates: Template[] = $state([]);
	let loadingTemplates = $state(true);
	let templateError = $state('');

	let selectedTemplateIndex = $state(0);
	let count = $state(1);
	let isCloning = $state(false);
	let cloneError = $state('');

	let instances: Instance[] = $state([]);

	async function fetchInstanceStatus(id: string) {
		try {
			const res = await fetch(`/api/pve/instances/${id}`);
			const data = await res.json();
			const inst = instances.find((i) => i.id === id);
			if (inst) {
				inst.status = data.status || 'unknown';
				inst.ip = data.ip || null;
			}
		} catch (e) {
			console.error(`Failed to fetch status for ${id}:`, e);
		}
	}

	async function doAction(id: string, action: 'stop' | 'start' | 'shutdown', silent = false) {
		const inst = instances.find((i) => i.id === id);
		if (inst) inst.status = 'loading';

		try {
			const res = await fetch(`/api/pve/instances/${id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			});
			const data = await res.json();
			if (data.error) {
				if (!silent) alert(`Action failed: ${data.error}`);
				else console.error(`Action failed for ${id}: ${data.error}`);
			}
			await fetchInstanceStatus(id);
		} catch (e) {
			if (!silent) alert(`Action failed: ${e instanceof Error ? e.message : String(e)}`);
			else console.error(`Action failed for ${id}:`, e);
			await fetchInstanceStatus(id);
		}
	}

	function performAction(id: string, action: 'stop' | 'start' | 'shutdown') {
		return doAction(id, action, false);
	}

	async function doDelete(id: string, silent = false) {
		const inst = instances.find((i) => i.id === id);
		if (inst) inst.status = 'loading';

		try {
			const res = await fetch(`/api/pve/instances/${id}`, {
				method: 'DELETE'
			});
			const data = await res.json();
			if (data.error) {
				if (!silent) alert(`Delete failed: ${data.error}`);
				else console.error(`Delete failed for ${id}: ${data.error}`);
				await fetchInstanceStatus(id);
			} else {
				instances = instances.filter((i) => i.id !== id);
			}
		} catch (e) {
			if (!silent) alert(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
			else console.error(`Delete failed for ${id}:`, e);
			await fetchInstanceStatus(id);
		}
	}

	function deleteInstance(id: string) {
		if (!confirm('Are you sure you want to delete this instance from Proxmox and our database?')) {
			return;
		}
		return doDelete(id, false);
	}

	let selectedInstances: string[] = $state([]);
	let isBatchActionRunning = $state(false);

	let allSelected = $derived(instances.length > 0 && selectedInstances.length === instances.length);

	function toggleSelectAll(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.checked) {
			selectedInstances = instances.map((i) => i.id);
		} else {
			selectedInstances = [];
		}
	}

	async function performBatchAction(action: 'stop' | 'start' | 'shutdown') {
		if (!confirm(`Are you sure you want to ${action} ${selectedInstances.length} instances?`)) return;
		isBatchActionRunning = true;
		
		const chunkSize = 5;
		for (let i = 0; i < selectedInstances.length; i += chunkSize) {
			const chunk = selectedInstances.slice(i, i + chunkSize);
			await Promise.allSettled(chunk.map((id) => doAction(id, action, true)));
		}
		
		isBatchActionRunning = false;
	}

	async function deleteBatchInstances() {
		const toDelete = selectedInstances.filter((id) => {
			const inst = instances.find((i) => i.id === id);
			return inst && inst.status === 'stopped';
		});

		if (toDelete.length === 0) {
			alert('No stopped instances selected. Only stopped instances can be deleted.');
			return;
		}

		if (!confirm(`Are you sure you want to delete ${toDelete.length} stopped instances?`)) return;
		isBatchActionRunning = true;

		const chunkSize = 5;
		for (let i = 0; i < toDelete.length; i += chunkSize) {
			const chunk = toDelete.slice(i, i + chunkSize);
			await Promise.allSettled(chunk.map((id) => doDelete(id, true)));
		}

		selectedInstances = selectedInstances.filter((id) => !toDelete.includes(id));
		isBatchActionRunning = false;
	}

	onMount(() => {
		const loadData = async () => {
			// Fetch templates
			try {
				const res = await fetch('/api/pve/templates');
				const data = await res.json();
				if (data.error) {
					templateError = data.error;
				} else {
					templates = data.templates || [];
				}
			} catch (e) {
				templateError = e instanceof Error ? e.message : String(e);
			} finally {
				loadingTemplates = false;
			}

			// Fetch existing instances
			try {
				const res = await fetch('/api/pve/instances');
				const data = await res.json();
				if (!data.error) {
					instances = (data.instances || []).map((i: Instance) => ({ ...i, status: 'loading' }));
					// Fetch initial status for all
					instances.forEach((inst) => fetchInstanceStatus(inst.id));
				}
			} catch (e) {
				console.error('Failed to fetch instances:', e);
			}
		};

		loadData();

		// Polling for status
		const interval = setInterval(() => {
			instances.forEach((inst) => fetchInstanceStatus(inst.id));
		}, 10000);

		return () => clearInterval(interval);
	});

	async function handleDeploy() {
		if (templates.length === 0) return;
		const template = templates[selectedTemplateIndex];

		isCloning = true;
		cloneError = '';

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
				cloneError = data.error;
			} else {
				const newClones = (data.clones as Instance[]).map((c) => ({
					...c,
					status: 'loading' as const
				}));
				instances = [...newClones, ...instances];
				newClones.forEach((c) => fetchInstanceStatus(c.id));
			}
		} catch (e) {
			cloneError = e instanceof Error ? e.message : String(e);
		} finally {
			isCloning = false;
		}
	}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Page Title -->
	<header class="mb-10 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight text-white">Admin Dashboard</h1>
			<p class="mt-2 text-sm text-gray-400">Manage templates and monitor all active VDI instances across your cluster.</p>
		</div>
		<div class="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
			<span class="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
			<span>Live Status</span>
		</div>
	</header>

	{#if loadingTemplates}
		<div class="flex flex-col items-center justify-center rounded-2xl border border-gray-800 bg-gray-800/50 p-20 text-center shadow-2xl backdrop-blur-sm">
			<div class="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4"></div>
			<span class="text-lg font-medium text-gray-300">Scanning Proxmox for Templates...</span>
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
		<div
			class="space-y-6 rounded-2xl border-2 border-dashed border-gray-700 bg-gray-800/30 p-16 text-center shadow-2xl"
		>
			<svg
				class="mx-auto h-16 w-16 text-gray-600"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
				/>
			</svg>
			<div class="space-y-2">
				<h3 class="text-2xl font-bold text-white">No Templates Found</h3>
				<p class="mx-auto max-w-lg leading-relaxed text-gray-400">
					We could not find any VM or LXC templates on your Proxmox cluster. Please log into Proxmox,
					right-click an existing VM or container, and select <strong>Convert to template</strong> to get
					started.
				</p>
			</div>
		</div>
	{:else}
		<!-- Deployment Card -->
		<div class="overflow-hidden rounded-2xl border border-gray-800 bg-gray-800 shadow-2xl ring-1 ring-white/5">
			<div class="border-b border-gray-700 bg-gray-800/50 px-8 py-5">
				<h2 class="flex items-center gap-3 text-lg font-bold text-white">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
						</svg>
					</div>
					Deploy New Instances
				</h2>
			</div>
			
			<div class="p-8">
				<div class="flex flex-col items-end gap-6 lg:flex-row">
					<div class="flex-1 space-y-2">
						<label for="template-select" class="block text-sm font-bold text-gray-400 uppercase tracking-tight"
							>Source Template</label
						>
						<select
							id="template-select"
							bind:value={selectedTemplateIndex}
							class="w-full rounded-xl border-gray-700 bg-gray-900 py-2.5 pl-4 pr-10 text-gray-200 shadow-sm transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
						>
							{#each templates as t, i (t.vmid)}
								<option value={i}
									>{t.name} (VMID: {t.vmid}, {t.type.toUpperCase()}, {t.node})</option
								>
							{/each}
						</select>
					</div>
					<div class="w-full space-y-2 lg:w-32">
						<label for="instance-count" class="block text-sm font-bold text-gray-400 uppercase tracking-tight">Count</label>
						<input
							id="instance-count"
							type="number"
							min="1"
							max="50"
							bind:value={count}
							class="w-full rounded-xl border-gray-700 bg-gray-900 py-2.5 text-center text-gray-200 shadow-sm transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
						/>
					</div>
					<button
						onclick={handleDeploy}
						disabled={isCloning}
						class="flex h-[46px] w-full min-w-[200px] items-center justify-center rounded-xl bg-indigo-600 px-8 py-3 font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
					>
						{#if isCloning}
							<svg class="mr-3 h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Working...
						{:else}
							Start Deployment
						{/if}
					</button>
				</div>
				{#if cloneError}
					<div class="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400">
						{cloneError}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Instances Table Section -->
	{#if instances.length > 0}
		<div class="mt-12 overflow-hidden rounded-2xl border border-gray-800 bg-gray-800 shadow-2xl ring-1 ring-white/5">
			<div class="flex flex-col gap-6 border-b border-gray-700 bg-gray-800/50 px-8 py-6 md:flex-row md:items-center md:justify-between">
				<div>
					<h3 class="text-xl font-extrabold text-white">Active Instances</h3>
					<span class="mt-1 flex items-center gap-1.5 text-xs font-medium text-gray-500">
						<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						Refreshed every 10 seconds
					</span>
				</div>
                
				{#if selectedInstances.length > 0}
					<div class="flex flex-wrap items-center gap-3 rounded-xl bg-gray-900/50 p-2 border border-gray-700">
						<span class="px-3 text-sm font-bold text-gray-400">
							{selectedInstances.length} Selected
						</span>
						<button
							onclick={() => performBatchAction('start')}
							disabled={isBatchActionRunning}
							class="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500 hover:text-white disabled:opacity-50"
						>
							Start
						</button>
						<button
							onclick={() => performBatchAction('stop')}
							disabled={isBatchActionRunning}
							class="rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-400 transition hover:bg-amber-500 hover:text-white disabled:opacity-50"
						>
							Stop
						</button>
						<button
							onclick={deleteBatchInstances}
							disabled={isBatchActionRunning}
							class="rounded-lg bg-red-500/20 px-4 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
						>
							Delete
						</button>
					</div>
				{/if}
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-left text-sm whitespace-nowrap">
					<thead>
						<tr class="bg-gray-900/50 text-[11px] font-bold uppercase tracking-widest text-gray-500">
							<th class="px-8 py-5 w-4">
								<input 
									type="checkbox" 
									checked={allSelected} 
									onchange={toggleSelectAll}
									class="h-4 w-4 rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-0"
								/>
							</th>
							<th class="px-8 py-5 text-center">Status</th>
							<th class="px-8 py-5">Instance ID</th>
							<th class="px-8 py-5">VMID</th>
							<th class="px-8 py-5">Type</th>
							<th class="px-8 py-5">Network IP</th>
							<th class="px-8 py-5">Controls</th>
							<th class="px-8 py-5 text-right w-10">Remove</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-700/50">
						{#each instances as inst (inst.id)}
							<tr class="transition-all hover:bg-white/[0.02]">
								<td class="px-8 py-4">
									<input 
										type="checkbox" 
										value={inst.id} 
										bind:group={selectedInstances}
										class="h-4 w-4 rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-0"
									/>
								</td>
								<td class="px-8 py-4 text-center">
									<div class="flex justify-center">
										{#if inst.status === 'running'}
											<span
												class="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
												title="Status: Running"
											></span>
										{:else if inst.status === 'stopped'}
											<span class="h-2.5 w-2.5 rounded-full bg-gray-600 border border-gray-500" title="Status: Stopped"
											></span>
										{:else}
											<span
												class="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]"
												title="Status: Loading/Pending"
											></span>
										{/if}
									</div>
								</td>
								<td class="px-8 py-4">
									<a href="/console/?id={inst.id}" target="_blank" class="font-mono text-sm font-bold text-indigo-400 hover:text-indigo-300 hover:underline">
										{inst.id}
									</a>
								</td>
								<td class="px-8 py-4 font-bold text-gray-300">{inst.vmid}</td>
								<td class="px-8 py-4">
									<span
										class="rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-tight
                                        {inst.type === 'qemu' ? 'text-sky-400' : 'text-fuchsia-400'}"
									>
										{inst.type}
									</span>
								</td>
								<td class="px-8 py-4">
									{#if inst.ip}
										<span class="font-mono text-xs font-semibold text-gray-300">{inst.ip}</span>
									{:else if inst.status === 'running'}
										<span class="flex items-center gap-2 text-xs font-medium text-gray-500 italic">
											<div class="h-1 w-1 bg-gray-600 rounded-full animate-bounce"></div>
											Fetching IP...
										</span>
									{:else}
										<span class="text-xs text-gray-600">—</span>
									{/if}
								</td>
								<td class="px-8 py-4">
									<div class="flex items-center gap-3">
										<button
											onclick={() => performAction(inst.id, 'start')}
											disabled={inst.status === 'running' || inst.status === 'loading'}
											class="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 transition-all hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
											title="Start Instance"
										>
											<svg class="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 20 20">
												<path d="M4.516 3.848a.5.5 0 0 1 .759-.424l11 7a.5.5 0 0 1 0 .848l-11 7a.5.5 0 0 1-.759-.424V3.848Z" />
											</svg>
										</button>
										<button
											onclick={() => performAction(inst.id, 'stop')}
											disabled={inst.status === 'stopped' || inst.status === 'loading'}
											class="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-500 transition-all hover:bg-amber-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
											title="Stop Instance"
										>
											<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
												<path d="M5 5h10v10H5z" />
											</svg>
										</button>
									</div>
								</td>
								<td class="px-8 py-4 text-right">
									<button
										onclick={() => deleteInstance(inst.id)}
										disabled={inst.status !== 'stopped'}
										class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 transition-all hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
										title="Permanent Delete"
									>
										<svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Zebra stripping alternative for dark theme */
	tbody tr:nth-child(even) {
		background-color: rgba(255, 255, 255, 0.015);
	}
</style>
