<script lang="ts">
	import VncViewer from '$lib/components/VncViewer.svelte';

	let vmId = $state('');
	let vncUrl = $state('');
	let vncPassword = $state('');
	let isConnecting = $state(false);

	async function handleConnect() {
        console.log("Connecting to: " + vmId);
		if (!vmId) return;
		
        vncUrl = '';
		isConnecting = true;
		try {
			const res = await fetch(`/api/vnc/${vmId}`, { method: 'POST' });
			if (!res.ok) throw new Error('Verbindung fehlgeschlagen');
			
			const data = await res.json();
			vncUrl = data.url;
			vncPassword = data.password;
		} catch (err) {
			alert('Fehler beim Abrufen der Konsole');
		} finally {
			isConnecting = false;
		}
	}
</script>

<main>
	<h1>PVE-VDI Manager</h1>

	<div class="login-box">
		<input 
			type="text" 
			bind:value={vmId} 
			placeholder="Deine VM-ID (z.B. 101)" 
		/>
		<button onclick={handleConnect} disabled={isConnecting}>
			{isConnecting ? 'Verbinde...' : 'VM Konsole öffnen'}
		</button>
	</div>

	{#if vncUrl}
		<section class="console">
			<h2>Konsole für VM {vmId}</h2>
			<VncViewer url={vncUrl} password={vncPassword} />
		</section>
	{/if}
</main>

<style>
	main { font-family: sans-serif; padding: 2rem; max-width: 900px; margin: 0 auto; }
	.login-box { display: flex; gap: 1rem; margin-bottom: 2rem; }
	input { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; flex-grow: 1; }
	button { padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
	button:disabled { background: #ccc; }
</style>