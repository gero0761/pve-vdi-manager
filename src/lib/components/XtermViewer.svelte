<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as XTerm from '@xterm/xterm';
	import { AttachAddon } from '@xterm/addon-attach';
	import '@xterm/xterm/css/xterm.css';

	const { Terminal } = XTerm;

	let { url, ticket, user }: { url: string; ticket?: string; user?: string } = $props();
	let terminalContainer: HTMLDivElement;
	let ws: WebSocket | null = null;
	let term: XTerm.Terminal;

	let isConnected = $state(false);

	let idlePingInterval: ReturnType<typeof setInterval>;

	onMount(async () => {
		//if (!terminalContainer || !ws) return;

		console.log('Mounting...');

		term = new Terminal({
			cursorBlink: true,
			theme: { background: '#1a1a1a' },
			fontFamily: 'monospace'
		});

		const socket = new WebSocket(url);
		ws = socket;
		socket.binaryType = 'arraybuffer';

		socket.addEventListener('open', () => {
			console.log('Terminal connected.');
		});

		socket.addEventListener('message', (e: MessageEvent) => {
			const res = new Uint8Array(e.data);

			console.log(res.toString());

			if (!isConnected && res.length === 2 && res[0] === 79 && res[1] === 75) {
				isConnected = true;
				console.log('Terminal authenticated.');

				return;
			}

			term.write(res);
		});

		socket.onopen = () => {
			// Proxmox termproxy requires username:ticket as the first message
			console.log('User: ' + user + ' Ticket: ' + ticket);
			if (user && ticket) {
				const authMsg = `${user}:${ticket}\n`;
				socket.send(authMsg);
				console.log('Auth handshake sent. AuthMsg: ', authMsg);
			}

			// Attach xterm AFTER auth so it handles subsequent I/O
			const attachAddon = new AttachAddon(socket);
			term.loadAddon(attachAddon);

			term.open(terminalContainer);

			setTimeout(() => {
				if (socket.readyState === 1) socket.send('\n');
			}, 200);

			// Send a ping every 30 seconds to keep the connection alive
			idlePingInterval = setInterval(() => {
				if (!isConnected) return;
				socket.send('2');
			}, 30_000);
		};

		socket.onerror = (e) => {
			console.error('Terminal WebSocket error:', e);
		};

		socket.onclose = (e) => {
			console.log('Terminal disconnected', e.code, e.reason);
		};

		//term.open(terminalContainer);
	});

	onDestroy(() => {
		if (idlePingInterval) clearInterval(idlePingInterval);
		if (ws) ws.close();
		if (term) term.dispose();
		console.log('Terminal destroyed!');
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
