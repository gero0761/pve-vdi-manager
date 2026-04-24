<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { taskQueue } from '$lib/stores/queue';
	import { fade, slide } from 'svelte/transition';

	let isExpanded = $state(true);

	onMount(() => {
		taskQueue.startPolling();
	});

	onDestroy(() => {
		taskQueue.stopPolling();
	});

	// Translate task types to friendly text
	function getTaskDescription(action: string, vmid: string) {
		switch (action) {
			case 'clone':
				return `Cloning into VM ${vmid}`;
			case 'start':
				return `Starting Instance ${vmid}`;
			case 'stop':
				return `Stopping Instance ${vmid}`;
			case 'delete':
				return `Destroying Instance ${vmid}`;
			default:
				return `Processing Instance ${vmid}`;
		}
	}
</script>

<div
	class="fixed right-6 bottom-6 z-50 w-80 font-sans shadow-2xl transition-all"
	transition:fade={{ duration: 200 }}
>
	<div
		class="overflow-hidden rounded-xl border border-gray-700 bg-gray-900/95 shadow-[0_8px_30px_rgb(0,0,0,0.5)] backdrop-blur-md"
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between border-b border-gray-800 bg-gray-800/60 px-4 py-3"
		>
			<div class="flex items-center gap-2">
				<div class="relative flex h-3 w-3">
					<span
						class="absolute inline-flex h-full w-full {$taskQueue.length > 0
							? 'animate-ping bg-indigo-400 opacity-75'
							: 'bg-gray-500 opacity-0'} rounded-full"
					></span>
					<span
						class="relative inline-flex h-3 w-3 rounded-full {$taskQueue.length > 0
							? 'bg-indigo-500'
							: 'bg-gray-500'}"
					></span>
				</div>
				<h3 class="text-sm font-bold tracking-wide text-white">PVE System Tasks</h3>
				<span class="rounded-full bg-gray-700 px-2 py-0.5 text-xs font-bold text-gray-300">
					{$taskQueue.length}
				</span>
			</div>
			<button
				class="text-gray-400 transition-colors hover:text-white"
				onclick={() => (isExpanded = !isExpanded)}
			>
				<svg
					class="h-5 w-5 transform transition-transform {isExpanded ? 'rotate-180' : ''}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>
		</div>

		<!-- List -->
		{#if isExpanded}
			<div class="max-h-96 overflow-y-auto p-2" transition:slide={{ duration: 200 }}>
				<div class="flex flex-col gap-2">
					{#if $taskQueue.length === 0}
						<div class="p-4 text-center text-sm text-gray-500 italic">
							No active background tasks.
						</div>
					{/if}
					{#each $taskQueue as task (task.id)}
						<div
							class="relative overflow-hidden rounded-lg border border-gray-800 bg-gray-800/40 p-3 transition-colors hover:bg-gray-800/60"
							transition:slide={{ duration: 200 }}
						>
							<!-- Status Accent Border (left) -->
							<div class="absolute top-0 bottom-0 left-0 w-1 bg-indigo-500"></div>

							<div class="ml-2 flex flex-col items-start gap-1">
								<div class="flex w-full items-center justify-between">
									<span class="text-xs font-bold tracking-wider text-gray-400 uppercase"
										>{task.action}</span
									>
									<!-- Status Icon -->
									<div class="flex items-center justify-center">
										<svg
											class="h-4 w-4 animate-spin text-indigo-400"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												class="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="3"
											></circle>
											<path
												class="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
									</div>
								</div>
								<span class="text-sm font-semibold text-gray-200">
									{getTaskDescription(task.action, task.vmid)}
								</span>
								<span class="mt-1 font-mono text-[10px] text-gray-500">Node: {task.node}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
