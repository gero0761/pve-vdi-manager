<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as XTerm from '@xterm/xterm';
	import { FitAddon } from '@xterm/addon-fit';
	import '@xterm/xterm/css/xterm.css';

	const { Terminal } = XTerm;

	let { url, ticket, user, height = '600px' }: { url: string; ticket: string; user: string; height?: string } = $props();
	let terminalContainer: HTMLDivElement;
	let ws: WebSocket | null = null;
	let term: XTerm.Terminal;

	//const realUser: string = 'svcVDIManager@pam';

	let idlePingInterval: ReturnType<typeof setInterval>;

	let isConnecting: boolean = false;

	onMount(async () => {
		//if (!terminalContainer || !ws) return;
		if (isConnecting) return;
		isConnecting = true;

		console.log('Mounting...');

		term = new Terminal({
			cursorBlink: true,
			theme: { background: '#1a1a1a' },
			fontFamily: 'monospace'
		});

		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);

		const socket = new WebSocket(url);
		socket.binaryType = 'arraybuffer';
		ws = socket;

		// Rezising Terminal:
		const resizeTerminal = (cols: number, rows: number) => {
			if (socket.readyState === WebSocket.OPEN) {
				// Format: '1:Spalten:Zeilen:'
				const msg = `1:${cols}:${rows}:`;
				socket.send(msg);
			}
		};

		// Event-Listener für Größenänderungen
		term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
			resizeTerminal(cols, rows);
		});

		socket.addEventListener('open', () => {
			console.log('Terminal connected.');
		});

		socket.onopen = () => {
			const encoder = new TextEncoder();

			// Proxmox termproxy requires username:ticket as the first message
			console.log('User: ' + user + ' Ticket: ' + ticket);
			console.log('Authenticating...');
			const authMsg = `${user}:${ticket}\n`;
			socket.send(encoder.encode(authMsg));
			//console.log('Auth handshake sent. AuthMsg: ', authMsg);
			console.log('Auth handshake sent.');

			// 2. TERMINAL ANZEIGEN & GRÖSSE ANPASSEN
			term.open(terminalContainer);
			fitAddon.fit(); // Berechnet die Größe basierend auf dem Div

			// 3. INITIALES RESIZE AN PROXMOX SENDEN
			// Das Backend braucht das, um den Shell-Prozess zu starten
			setTimeout(() => {
				fitAddon.fit();
				// Erst jetzt weiß term.cols und term.rows, wie viel Platz da ist
				socket.send(encoder.encode(`1:${term.cols}:${term.rows}:`));
				console.log(`Initial resize sent: ${term.cols}x${term.rows}`);
			}, 10);

			console.log('Connected via termproxy!');
		};

		// Adding DATA Prefix to data
		term.onData((data) => {
			if (socket.readyState === WebSocket.OPEN) {
				//console.log('Sending data: ' + data);
				socket.send('0:' + data.length + ':' + data);
			}
		});

		// Removing Prefix from datan when recveiveing
		socket.onmessage = async (event) => {
			let data = event.data;

			if (event.data instanceof Blob) {
				const text = await event.data.text();
				term.write(text);
			} else if (typeof event.data === 'string') {
				term.write(event.data);
			} else {
				// Fallback für ArrayBuffer
				const buffer = new Uint8Array(event.data);
				term.write(buffer);
			}

			// Nur Typ 0: (Daten vom Server) an xterm.js weiterreichen
			if (typeof data === 'string' && data.startsWith('0:')) {
				term.write(data.slice(2));
			} else if (typeof data === 'string' && data.startsWith('1:')) {
				// Falls Proxmox ein Resize-Feedback schickt (selten, aber möglich)
				console.log('Server requested resize (ignored for now)');
			}
		};

		socket.onerror = (e) => {
			console.error('Terminal WebSocket error:', e);
		};

		socket.onclose = (e) => {
			console.log('Terminal disconnected', e.code, e.reason);
		};

		idlePingInterval = setInterval(() => {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send('2');
			}
		}, 30000);
	});

	onDestroy(() => {
		if (ws) ws.close();
		if (term) term.dispose();
		if (idlePingInterval) clearInterval(idlePingInterval);
		console.log('Terminal destroyed!');
	});
</script>

<div bind:this={terminalContainer} class="terminal-wrapper" style="height: {height}"></div>

<style>
	.terminal-wrapper {
		width: 100%;
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
