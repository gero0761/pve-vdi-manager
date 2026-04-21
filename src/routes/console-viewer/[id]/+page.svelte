<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import VncViewer from '$lib/components/VncViewer.svelte';
	import XtermViewer from '$lib/components/XtermViewer.svelte';
	import SpinningCircle from '$lib/components/SpinningCircle.svelte';

	let vmId = $derived(page.params.id);
	let vncUrl = $state('');
	let vncTicket = $state('');
	let vncUser = $state('');
	let proxyType = $state('vnc');
	let isConnecting = $state(true);
	let error = $state('');

	async function connect() {
		if (!vmId) {
			error = 'No VM ID provided';
			isConnecting = false;
			return;
		}

		try {
			const res = await fetch(`/api/vnc/${vmId}`, { method: 'POST' });
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Connection failed');
			}

			const data = await res.json();
			vncUrl = data.url;
			vncTicket = data.ticket;
			vncUser = data.user;
			proxyType = data.proxyType || 'vnc';
		} catch (err) {
			console.error('Error fetching VNC console:', err);
			error = err instanceof Error ? err.message : 'Error fetching VNC console';
		} finally {
			isConnecting = false;
		}
	}

	onMount(() => {
		connect();
	});
</script>

<div class="h-screen w-screen bg-black overflow-hidden flex flex-col items-center justify-center">
	{#if isConnecting}
		<div class="flex flex-col items-center gap-4 text-emerald-500">
			<SpinningCircle />
			<p class="text-sm font-bold tracking-widest uppercase">Connecting to instance...</p>
		</div>
	{:else if error}
		<div class="max-w-md p-8 bg-gray-900 border border-red-500/50 rounded-2xl text-center">
			<div class="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-red-500/10 text-red-500">
				<svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
			</div>
			<h2 class="text-xl font-bold text-white mb-2">Connection Error</h2>
			<p class="text-gray-400 mb-6">{error}!</p>
			<button 
				onclick={connect}
				class="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors"
			>
				Retry Connection
			</button>
		</div>
	{:else if vncUrl}
		{#if proxyType === 'term'}
			<XtermViewer url={vncUrl} ticket={vncTicket} user={vncUser} height="100vh" />
		{:else}
			<VncViewer url={vncUrl} password={vncTicket} height="100vh" />
		{/if}
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		background: black;
	}
</style>
