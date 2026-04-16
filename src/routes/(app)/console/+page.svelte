<script lang="ts">
	import { page } from '$app/state';
	import VncViewer from '$lib/components/VncViewer.svelte';
	import XtermViewer from '$lib/components/XtermViewer.svelte';

	let vmId = $state(page.url.searchParams.get('id') || '');
	let vncUrl = $state('');
	let vncTicket = $state('');
	let vncUser = $state('');
	let proxyType = $state('vnc');
	let isConnecting = $state(false);

	async function handleConnect() {
		console.log('Connecting to: ' + vmId);
		if (!vmId) return;

		vncUrl = '';
		isConnecting = true;
		try {
			const res = await fetch(`/api/vnc/${vmId}`, { method: 'POST' });
			if (!res.ok) throw new Error('Connection failed');

			const data = await res.json();
			vncUrl = data.url;
			vncTicket = data.ticket;
			vncUser = data.user;
			proxyType = data.proxyType || 'vnc';
		} catch (err) {
			console.error('Error fetching VNC console:', err);
			alert('Error fetching VNC console');
		} finally {
			isConnecting = false;
			/* console.log('Connection URL: ' + vncUrl + '\n');
			console.log('Ticket: ' + vncTicket + '\n');
			console.log('User: ' + vncUser + '\n');
			console.log('Proxy Type: ' + proxyType + '\n'); */
		}
	}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Page Header -->
	<header class="mb-10">
		<h1 class="text-3xl font-extrabold tracking-tight text-white">Instance Console</h1>
		<p class="mt-2 text-sm text-gray-400">Establish a secure remote connection to your virtual machine or container.</p>
	</header>

	<div class="space-y-8">
		<!-- Connection Control Card -->
		<div class="overflow-hidden rounded-2xl border border-gray-800 bg-gray-800 shadow-2xl ring-1 ring-white/5">
			<div class="border-b border-gray-700 bg-gray-800/50 px-8 py-5">
				<h2 class="flex items-center gap-3 text-lg font-bold text-white">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
					</div>
					Connection Settings
				</h2>
			</div>

			<div class="p-8">
				<div class="flex flex-col items-end gap-6 md:flex-row">
					<div class="flex-1 space-y-2">
						<label for="vm-id" class="block text-sm font-bold text-gray-400 uppercase tracking-tight">Access ID or VMID</label>
						<div class="relative">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
							</div>
							<input
								id="vm-id"
								type="text"
								bind:value={vmId}
								placeholder="Enter Instance ID (e.g. 101 or UUID)"
								class="w-full rounded-xl border-gray-700 bg-gray-900 py-3 pl-10 pr-4 text-gray-200 shadow-sm transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					</div>
					<button
						onclick={handleConnect}
						disabled={isConnecting || !vmId}
						class="flex h-[50px] w-full items-center justify-center rounded-xl bg-emerald-600 px-8 py-3 font-bold text-white shadow-lg shadow-emerald-600/30 transition-all hover:bg-emerald-500 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
					>
						{#if isConnecting}
							<svg class="mr-3 h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Connecting...
						{:else}
							Establish Connection
						{/if}
					</button>
				</div>
			</div>
		</div>

		<!-- Console View Area -->
		{#if vncUrl}
			<div class="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl ring-1 ring-white/5">
				<div class="flex items-center justify-between border-b border-gray-800 bg-gray-800/50 px-8 py-4">
					<div class="flex items-center gap-3">
						<span class="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
						<h3 class="text-sm font-bold text-white uppercase tracking-widest">
							Console Session: {vmId}
						</h3>
					</div>
					<div class="flex items-center gap-2">
						<span class="rounded bg-gray-700 px-2 py-1 text-[10px] font-black text-gray-300 uppercase">
							Mode: {proxyType === 'term' ? 'XTerm.js' : 'noVNC'}
						</span>
					</div>
				</div>
				<div class="bg-black p-4">
					<div class="mx-auto overflow-hidden rounded-lg border border-gray-800">
						{#if proxyType === 'term'}
							<XtermViewer url={vncUrl} ticket={vncTicket} user={vncUser} />
						{:else}
							<VncViewer url={vncUrl} password={vncTicket} />
						{/if}
					</div>
				</div>
				<div class="border-t border-gray-800 bg-gray-800/30 px-8 py-3 text-center">
					<p class="text-[10px] font-medium text-gray-500 uppercase tracking-widest">
						Connection remains active while this tab is open
					</p>
				</div>
			</div>
		{:else if !isConnecting}
			<div class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-800 bg-gray-800/10 p-20 text-center">
				<div class="mb-4 rounded-full bg-gray-800 p-4 text-gray-600">
					<svg class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
					</svg>
				</div>
				<h3 class="text-xl font-bold text-gray-400">No Active Session</h3>
				<p class="mt-2 text-sm text-gray-500">Enter a VM ID or select one from the dashboard to start a console session.</p>
			</div>
		{/if}
	</div>
</div>

