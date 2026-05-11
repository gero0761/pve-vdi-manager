<script lang="ts">
	import SpinningCircle from './SpinningCircle.svelte';

	interface Group {
		id: string;
		name: string;
		description: string;
	}

	let { 
		isOpen = false, 
		instanceIds = [] as string[], 
		vmid = 0, // Fallback for single instance display
		onConfirm = (keepGroupIds: string[]) => {}, 
		onCancel = () => {} 
	} = $props();

	let groups = $state<Group[]>([]);
	let selectedGroupIds = $state<string[]>([]);
	let isLoading = $state(true);
	let isDeleting = $state(false);

	$effect(() => {
		if (isOpen && instanceIds.length > 0) {
			fetchGroups();
		}
	});

	async function fetchGroups() {
		isLoading = true;
		try {
			const res = await fetch(`/api/pve/instances/bulk-deletion-preview`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ instanceIds })
			});
			const data = await res.json();
			groups = data.groups || [];
			selectedGroupIds = groups.map(g => g.id); // All selected by default
		} catch (e) {
			console.error('Failed to fetch deletion preview:', e);
		} finally {
			isLoading = false;
		}
	}

	function toggleGroup(id: string) {
		if (selectedGroupIds.includes(id)) {
			selectedGroupIds = selectedGroupIds.filter(gid => gid !== id);
		} else {
			selectedGroupIds = [...selectedGroupIds, id];
		}
	}

	function handleConfirm() {
		isDeleting = true;
		// The groups NOT in selectedGroupIds are the ones we want to KEEP
		const keepGroupIds = groups
			.filter(g => !selectedGroupIds.includes(g.id))
			.map(g => g.id);
		
		onConfirm(keepGroupIds);
		// Reset state for next time
		isDeleting = false; 
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-200">
		<div class="w-full max-w-md overflow-hidden rounded-3xl border border-gray-700 bg-gray-800 shadow-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
			<!-- Header -->
			<div class="bg-red-500/10 px-6 py-4 border-b border-red-500/20">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-white">
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-bold text-white">
							{#if instanceIds.length === 1}
								Delete Instance VM {vmid}
							{:else}
								Delete {instanceIds.length} Instances
							{/if}
						</h3>
						<p class="text-xs text-red-400 font-medium">This action cannot be undone.</p>
					</div>
				</div>
			</div>

			<!-- Content -->
			<div class="p-6">
				<p class="text-sm text-gray-300 leading-relaxed mb-6">
					{#if instanceIds.length === 1}
						Are you sure you want to delete this instance?
					{:else}
						Are you sure you want to delete these <strong>{instanceIds.length} instances</strong>?
					{/if}
					The following groups will have no remaining permissions and will be <strong>deleted automatically</strong> unless you uncheck them:
				</p>

				<div class="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
					{#if isLoading}
						<div class="flex justify-center py-8">
							<SpinningCircle size="h-8 w-8" color="text-red-500" />
						</div>
					{:else if groups.length > 0}
						{#each groups as group (group.id)}
							<button 
								onclick={() => toggleGroup(group.id)}
								class="w-full flex items-center justify-between p-3 rounded-xl border transition-all {selectedGroupIds.includes(group.id) ? 'bg-red-500/5 border-red-500/30' : 'bg-gray-900 border-gray-700 hover:border-gray-600'}"
							>
								<div class="text-left flex-1 min-w-0 pr-4">
									<p class="text-sm font-bold truncate {selectedGroupIds.includes(group.id) ? 'text-red-400' : 'text-gray-300'}">{group.name}</p>
									<p class="text-[10px] text-gray-500 mt-0.5 truncate">{group.description || 'No description'}</p>
								</div>
								<div class="flex h-5 w-5 shrink-0 items-center justify-center rounded border {selectedGroupIds.includes(group.id) ? 'bg-red-500 border-red-500 text-white' : 'border-gray-600 bg-gray-800'}">
									{#if selectedGroupIds.includes(group.id)}
										<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="4">
											<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
										</svg>
									{/if}
								</div>
							</button>
						{/each}
					{:else}
						<div class="p-4 rounded-xl bg-gray-900/50 border border-gray-700 text-center">
							<p class="text-xs text-gray-500 italic">No orphaned groups found for cleanup.</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Footer -->
			<div class="bg-gray-900/50 px-6 py-4 flex gap-3 border-t border-gray-700">
				<button 
					onclick={onCancel}
					disabled={isDeleting}
					class="flex-1 rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-bold text-gray-300 hover:bg-gray-700 transition-all disabled:opacity-50"
				>
					Cancel
				</button>
				<button 
					onclick={handleConfirm}
					disabled={isDeleting}
					class="flex-[2] rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-500 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
				>
					{#if isDeleting}
						<SpinningCircle size="h-4 w-4" color="text-white" />
						Deleting...
					{:else}
						Delete Instance
					{/if}
				</button>
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
		background: rgba(239, 68, 68, 0.2);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(239, 68, 68, 0.4);
	}
</style>
