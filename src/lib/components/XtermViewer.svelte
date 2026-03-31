<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import '@xterm/xterm/css/xterm.css';

	let { url, password, user }: { url: string; password?: string; user?: string } = $props();
	let terminalContainer: HTMLDivElement | undefined = $state();
	let socket: WebSocket | null = null;
	
	onMount(async () => {
		if (url && terminalContainer) {
			const { Terminal } = await import('@xterm/xterm');
			const { AttachAddon } = await import('@xterm/addon-attach');

			const term = new Terminal({
				cursorBlink: true,
				theme: { background: '#1a1a1a' },
				fontFamily: 'monospace'
			});

			term.open(terminalContainer);
			
			socket = new WebSocket(url, 'binary');
			socket.binaryType = 'arraybuffer';

			socket.onopen = () => {
				console.log('Terminal connected. Waking up TTY implicitly.');

				// Attach xterm to let it handle I/O naturally
				const attachAddon = new AttachAddon(socket);
				term.loadAddon(attachAddon);

				// Send an enter keystroke to wake up the TTY login screen!
				// Proxmox terminals are sometimes already authenticated by vncwebsocket
				// but just need input to render the initial login prompt.
				setTimeout(() => {
					if (socket && socket.readyState === WebSocket.OPEN) {
						socket.send("\r");
					}
				}, 500);
			};

			socket.onclose = (e) => {
				console.log('Terminal disconnected', e.code, e.reason);
			};
		}
	});

	onDestroy(() => {
		if (socket) socket.close();
	});
</script>

<div bind:this={terminalContainer} class="terminal-wrapper"></div>

<style>
	.terminal-wrapper {
		width: 100%;
		height: 600px;
		background: #1a1a1a;
		border-radius: 8px;
		overflow: hidden;
		padding: 8px;
	}
	
	/* Make terminal fill the wrapper */
	:global(.terminal-wrapper .xterm) {
		height: 100%;
		padding: 0.5rem;
	}
	:global(.terminal-wrapper .xterm-viewport) {
		overflow-y: auto !important;
	}
</style>
