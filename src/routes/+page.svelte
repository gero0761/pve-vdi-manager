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
			console.log('Connection URL: ' + vncUrl + '\n');
			console.log('Ticket: ' + vncTicket + '\n');
			console.log('User: ' + vncUser + '\n');
			console.log('Proxy Type: ' + proxyType + '\n');
		}
	}
</script>

<main>
	<h1>PVE-VDI Manager</h1>

	<div class="login-box">
		<input type="text" bind:value={vmId} placeholder="VM ID (e.g. 101)" />
		<button onclick={handleConnect} disabled={isConnecting}>
			{isConnecting ? 'Connecting...' : 'Open VM Console'}
		</button>
	</div>

	{#if vncUrl}
		<section class="console">
			<h2>Konsole für VM {vmId}</h2>
			{#if proxyType === 'term'}
				<XtermViewer url={vncUrl} ticket={vncTicket} user={vncUser} />
			{:else}
				<VncViewer url={vncUrl} password={vncTicket} />
			{/if}
		</section>
	{/if}
</main>

<style>
	main {
		font-family: sans-serif;
		padding: 2rem;
		max-width: 900px;
		margin: 0 auto;
	}
	.login-box {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;
	}
	input {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		flex-grow: 1;
	}
	button {
		padding: 0.5rem 1rem;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}
	button:disabled {
		background: #ccc;
	}
</style>
