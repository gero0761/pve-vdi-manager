<script lang="ts">
	import { fade, scale } from 'svelte/transition';

	let { 
		isOpen = false, 
		title = 'Confirm', 
		message = '', 
		confirmText = 'Confirm', 
		cancelText = 'Cancel', 
		type = 'warning', 
		onConfirm, 
		onCancel 
	} = $props<{
		isOpen: boolean;
		title?: string;
		message: string;
		confirmText?: string;
		cancelText?: string;
		type?: 'danger' | 'warning' | 'info';
		onConfirm: () => void;
		onCancel: () => void;
	}>();

	// Define colors based on type
	const typeConfig = $derived({
		danger: {
			iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
			iconColor: 'text-red-400',
			iconBg: 'bg-red-500/20',
			btnColor: 'bg-red-600 hover:bg-red-500 ring-red-500'
		},
		warning: {
			iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
			iconColor: 'text-amber-400',
			iconBg: 'bg-amber-500/20',
			btnColor: 'bg-amber-600 hover:bg-amber-500 ring-amber-500'
		},
		info: {
			iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
			iconColor: 'text-indigo-400',
			iconBg: 'bg-indigo-500/20',
			btnColor: 'bg-indigo-600 hover:bg-indigo-500 ring-indigo-500'
		}
	}[type as 'danger' | 'warning' | 'info']);
</script>

{#if isOpen}
	<div 
		class="fixed inset-0 z-[100] flex items-center justify-center font-sans"
		transition:fade={{ duration: 200 }}
	>
		<!-- Backdrop -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div 
			class="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"
			onclick={onCancel}
		></div>

		<!-- Dialog Modal -->
		<div 
			class="relative w-full max-w-md transform overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 p-6 text-left shadow-2xl transition-all"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<div class="sm:flex sm:items-start">
				<div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10 {typeConfig.iconBg}">
					<svg class="h-6 w-6 {typeConfig.iconColor}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={typeConfig.iconPath} />
					</svg>
				</div>
				<div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
					<h3 class="text-lg font-bold leading-6 text-white" id="modal-title">
						{title}
					</h3>
					<div class="mt-2 text-sm text-gray-300">
						<!-- Allow basic HTML line breaks by using {@html} -->
						{@html message}
					</div>
				</div>
			</div>
			<div class="mt-8 sm:mt-6 sm:flex sm:flex-row-reverse gap-3">
				<!-- Confirm Button -->
				<button 
					type="button" 
					class="inline-flex w-full justify-center rounded-xl border border-transparent px-4 py-2.5 text-sm font-bold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 sm:w-auto transition-colors {typeConfig.btnColor}"
					onclick={onConfirm}
				>
					{confirmText}
				</button>
				
				<!-- Cancel Button -->
				{#if cancelText}
					<button 
						type="button" 
						class="mt-3 inline-flex w-full justify-center rounded-xl border border-gray-600 bg-gray-700 px-4 py-2.5 text-sm font-bold text-gray-300 shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 sm:mt-0 sm:w-auto transition-colors"
						onclick={onCancel}
					>
						{cancelText}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
