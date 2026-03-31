<script lang="ts">
	import { onMount } from 'svelte';

	type Template = { vmid: number; name: string; node: string; type: 'qemu' | 'lxc' };
	type Instance = { id: string; vmid: number; type: string; node: string; created_at: number };

	let templates: Template[] = $state([]);
	let loadingTemplates = $state(true);
	let templateError = $state('');

	let selectedTemplateIndex = $state(0);
	let count = $state(1);
	let isCloning = $state(false);
	let cloneError = $state('');

	let generatedInstances: Instance[] = $state([]);

	onMount(async () => {
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
				generatedInstances = [...data.clones, ...generatedInstances];
			}
		} catch (e) {
			cloneError = e instanceof Error ? e.message : String(e);
		} finally {
			isCloning = false;
		}
	}
</script>

<div class="mx-auto max-w-4xl space-y-8 p-6">
	<div class="flex items-center justify-between">
		<h1
			class="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-3xl font-bold text-transparent"
		>
			VDI Admin Control Panel
		</h1>
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
					<label for="template-select" class="block text-sm font-medium text-slate-700">Select Template</label>
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

	{#if generatedInstances.length > 0}
		<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 bg-slate-50 px-6 py-4">
				<h3 class="text-lg font-bold text-slate-800">
					Generated Instances ({generatedInstances.length})
				</h3>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-left text-sm whitespace-nowrap">
					<thead class="bg-slate-50 text-xs text-slate-500 uppercase">
						<tr>
							<th class="px-6 py-3">Access ID</th>
							<th class="px-6 py-3">Target VMID</th>
							<th class="px-6 py-3">Type</th>
							<th class="px-6 py-3">Node</th>
							<th class="px-6 py-3">Direct Link</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200">
						{#each generatedInstances as inst (inst.id)}
							<tr class="transition-colors hover:bg-indigo-50/30">
								<td class="px-6 py-4 font-mono font-medium text-indigo-600">{inst.id}</td>
								<td class="px-6 py-4 text-slate-600">{inst.vmid}</td>
								<td class="px-6 py-4">
									<span
										class="rounded px-2 py-1 text-xs font-semibold
                                        {inst.type === 'qemu'
											? 'bg-sky-100 text-sky-700'
											: 'bg-fuchsia-100 text-fuchsia-700'}"
									>
										{inst.type.toUpperCase()}
									</span>
								</td>
								<td class="px-6 py-4 text-slate-600">{inst.node}</td>
								<td class="px-6 py-4">
									<a
										href="/?id={inst.id}"
										target="_blank"
										class="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
									>
										Open Web VNC
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
											/></svg
										>
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
