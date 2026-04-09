<script lang="ts">
	import { onMount } from 'svelte';

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

	async function performAction(id: string, action: 'stop' | 'start' | 'shutdown') {
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
				alert(`Action failed: ${data.error}`);
			}
			await fetchInstanceStatus(id);
		} catch (e) {
			alert(`Action failed: ${e instanceof Error ? e.message : String(e)}`);
			await fetchInstanceStatus(id);
		}
	}

	async function deleteInstance(id: string) {
		if (!confirm('Are you sure you want to delete this instance from Proxmox and our database?')) {
			return;
		}

		const inst = instances.find((i) => i.id === id);
		if (inst) inst.status = 'loading';

		try {
			const res = await fetch(`/api/pve/instances/${id}`, {
				method: 'DELETE'
			});
			const data = await res.json();
			if (data.error) {
				alert(`Delete failed: ${data.error}`);
				await fetchInstanceStatus(id);
			} else {
				instances = instances.filter((i) => i.id !== id);
			}
		} catch (e) {
			alert(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
			await fetchInstanceStatus(id);
		}
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

<div class="mx-auto max-w-5xl space-y-8 p-6">
	<div class="flex items-center justify-between">
		<a href="https://github.com/gero0761/pve-vdi-manager">
			<img src="/pve-vdi-logo_dark.svg" width="660" alt="PVE VDI Manager" />
		</a>
		<div
			class="rounded border bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 shadow-inner"
		>
			SuperAdmin
		</div>
	</div>

	{#if loadingTemplates}
		<div class="shimmer rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
			<span class="font-medium text-slate-500">Scanning Proxmox Cluster for Templates...</span>
		</div>
	{:else if templateError}
		<div class="rounded-xl border-l-4 border-red-500 bg-red-50 p-6 font-medium text-red-700">
			Error: {templateError}
		</div>
	{:else if templates.length === 0}
		<div
			class="space-y-4 rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50 p-10 text-center shadow-sm"
		>
			<svg
				class="mx-auto h-12 w-12 text-orange-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<h3 class="text-xl font-bold text-orange-800">No Templates Found</h3>
			<p class="mx-auto max-w-lg leading-relaxed text-orange-700">
				We could not find any VM or LXC templates on your Proxmox cluster. Please log into Proxmox,
				right-click an existing VM or container, and select <strong>Convert to template</strong> to get
				started.
			</p>
		</div>
	{:else}
		<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<h2 class="mb-6 flex items-center gap-2 text-xl font-semibold">
				<svg class="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
					/></svg
				>
				Deploy New Instances
			</h2>
			<div class="flex flex-col items-end gap-4 md:flex-row">
				<div class="flex-1 space-y-2">
					<label for="template-select" class="block text-sm font-medium text-slate-700"
						>Select Template</label
					>
					<select
						id="template-select"
						bind:value={selectedTemplateIndex}
						class="w-full rounded-lg border-slate-300 bg-slate-50 shadow-sm transition-colors focus:border-indigo-500 focus:ring-indigo-500"
					>
						{#each templates as t, i (t.vmid)}
							<option value={i}
								>{t.name} (VMID: {t.vmid}, Type: {t.type.toUpperCase()}, Node: {t.node})</option
							>
						{/each}
					</select>
				</div>
				<div class="w-32 space-y-2">
					<label for="instance-count" class="block text-sm font-medium text-slate-700">Count</label>
					<input
						id="instance-count"
						type="number"
						min="1"
						max="50"
						bind:value={count}
						class="w-full rounded-lg border-slate-300 bg-slate-50 text-center shadow-sm transition-colors focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>
				<button
					onclick={handleDeploy}
					disabled={isCloning}
					class="h-[42px] min-w-[140px] rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if isCloning}
						<span class="animate-pulse">Deploying...</span>
					{:else}
						Deploy Clones
					{/if}
				</button>
			</div>
			{#if cloneError}
				<p class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
					{cloneError}
				</p>
			{/if}
		</div>
	{/if}

	{#if instances.length > 0}
		<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div
				class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4"
			>
				<h3 class="text-lg font-bold text-slate-800">
					All Active Instances ({instances.length})
				</h3>
				<span class="text-xs text-slate-400">Updates every 10s</span>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-left text-sm whitespace-nowrap">
					<thead class="bg-slate-50 text-xs text-slate-500 uppercase">
						<tr>
							<th class="px-6 py-3 text-center">Status</th>
							<th class="px-6 py-3">Access ID</th>
							<th class="px-6 py-3">Target VMID</th>
							<th class="px-6 py-3">Type</th>
							<th class="px-6 py-3">IP Address</th>
							<th class="px-6 py-3">Actions</th>
							<th class="px-6 py-3 text-right">Delete</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200">
						{#each instances as inst (inst.id)}
							<tr class="transition-colors hover:bg-indigo-50/30">
								<td class="px-6 py-4 text-center">
									{#if inst.status === 'running'}
										<span
											class="mx-auto flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
											title="Running"
										></span>
									{:else if inst.status === 'stopped'}
										<span class="mx-auto flex h-3 w-3 rounded-full bg-slate-300" title="Stopped"
										></span>
									{:else}
										<span
											class="mx-auto flex h-3 w-3 animate-pulse rounded-full bg-amber-400"
											title="Loading/Unknown"
										></span>
									{/if}
								</td>
								<td class="px-6 py-4 font-mono font-medium text-indigo-600">
									<a href="/?id={inst.id}" target="_blank" class="hover:underline">{inst.id}</a>
								</td>
								<td class="px-6 py-4 text-slate-600">{inst.vmid}</td>
								<td class="px-6 py-4">
									<span
										class="rounded px-2 py-1 text-[10px] font-bold uppercase
                                        {inst.type === 'qemu'
											? 'bg-sky-100 text-sky-700'
											: 'bg-fuchsia-100 text-fuchsia-700'}"
									>
										{inst.type}
									</span>
								</td>
								<td class="px-6 py-4">
									{#if inst.ip}
										<span class="font-mono text-xs text-slate-700">{inst.ip}</span>
									{:else if inst.status === 'running'}
										<span class="text-xs italic text-slate-400">Fetching...</span>
									{:else}
										<span class="text-xs text-slate-300">—</span>
									{/if}
								</td>
								<td class="space-x-2 px-6 py-4">
									<button
										onclick={() => performAction(inst.id, 'start')}
										disabled={inst.status === 'running' || inst.status === 'loading'}
										class="rounded bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-30"
										title="Start"
									>
										<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"
											><path
												d="M4.516 3.848a.5.5 0 0 1 .759-.424l11 7a.5.5 0 0 1 0 .848l-11 7a.5.5 0 0 1-.759-.424V3.848Z"
											/></svg
										>
									</button>
									<button
										onclick={() => performAction(inst.id, 'stop')}
										disabled={inst.status === 'stopped' || inst.status === 'loading'}
										class="rounded bg-amber-50 p-1.5 text-amber-600 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-30"
										title="Stop"
									>
										<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"
											><path d="M5 5h10v10H5z" /></svg
										>
									</button>
								</td>
								<td class="px-6 py-4 text-right">
									<button
										onclick={() => deleteInstance(inst.id)}
										disabled={inst.status !== 'stopped'}
										class="rounded bg-red-50 p-1.5 text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-30"
										title="Delete Instance (Only if stopped)"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/></svg
										>
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
