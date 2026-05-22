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

	let idlePingInterval: ReturnType<typeof setInterval>;
	let isConnecting: boolean = false;

	let isExpanded = $state(false);
	let activeModifiers = $state({
		ctrl: false,
		alt: false,
		super: false,
		shift: false
	});

	onMount(async () => {
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

		// Resizing Terminal:
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
				let modifiedData = data;
				if (activeModifiers.ctrl || activeModifiers.alt || activeModifiers.super || activeModifiers.shift) {
					// Apply modifiers
					if (activeModifiers.super && modifiedData.length === 1) {
						const keycode = modifiedData.toLowerCase().charCodeAt(0);
						let modifier = 1;
						if (activeModifiers.shift) modifier += 1;
						if (activeModifiers.alt) modifier += 2;
						if (activeModifiers.ctrl) modifier += 4;
						modifier += 8; // Super
						
						modifiedData = `\x1b[${keycode};${modifier}u`;
					} else {
						// 1. Shift (make single chars uppercase)
						if (activeModifiers.shift && modifiedData.length === 1) {
							modifiedData = modifiedData.toUpperCase();
						}
						// 2. Ctrl (convert single char to ANSI control character)
						if (activeModifiers.ctrl && modifiedData.length === 1) {
							const code = modifiedData.toUpperCase().charCodeAt(0);
							if (code >= 64 && code <= 95) {
								modifiedData = String.fromCharCode(code - 64);
							}
						}
						// 3. Alt (prepend ESC character \x1b)
						if (activeModifiers.alt) {
							modifiedData = '\x1b' + modifiedData;
						}
					}

					// Auto-untoggle modifiers after single use for convenience
					activeModifiers.ctrl = false;
					activeModifiers.alt = false;
					activeModifiers.super = false;
					activeModifiers.shift = false;
				}
				socket.send('0:' + modifiedData.length + ':' + modifiedData);
			}
		});

		// Removing Prefix from data when receiving
		socket.onmessage = async (event) => {
			let data = event.data;

			if (event.data instanceof Blob) {
				const text = await event.data.text();
				term.write(text);
			} else if (typeof event.data === 'string') {
				term.write(event.data);
			} else {
				const buffer = new Uint8Array(event.data);
				term.write(buffer);
			}

			if (typeof data === 'string' && data.startsWith('0:')) {
				term.write(data.slice(2));
			} else if (typeof data === 'string' && data.startsWith('1:')) {
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

	function sendTerminalString(str: string) {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send('0:' + str.length + ':' + str);
			if (term) term.focus();
		}
	}

	function toggleModifier(name: 'ctrl' | 'alt' | 'super' | 'shift') {
		activeModifiers[name] = !activeModifiers[name];
		if (term) term.focus();
	}

	onDestroy(() => {
		if (ws) ws.close();
		if (term) term.dispose();
		if (idlePingInterval) clearInterval(idlePingInterval);
		console.log('Terminal destroyed!');
	});
</script>

<div class="xterm-container" style="height: {height}">
	<div bind:this={terminalContainer} class="terminal-wrapper"></div>

	<!-- Sidebar -->
	<div class="sidebar-container" class:expanded={isExpanded}>
		<button
			class="sidebar-handle"
			onclick={() => (isExpanded = !isExpanded)}
			title={isExpanded ? 'Extra-Tasten einklappen' : 'Extra-Tasten ausklappen'}
		>
			<svg
				class="h-4 w-4 transform transition-transform"
				class:rotate-180={isExpanded}
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
		</button>

		<div class="sidebar-content">
			<div class="sidebar-title">Extra-Tasten</div>

			<button onclick={() => sendTerminalString('\x03')} class="action-btn" title="Strg+C (Interrupt) senden">
				Ctrl+C
			</button>

			<button onclick={() => sendTerminalString('\x04')} class="action-btn" title="Strg+D (EOF/Logout) senden">
				Ctrl+D
			</button>

			<button onclick={() => sendTerminalString('\x1a')} class="action-btn" title="Strg+Z (Suspend) senden">
				Ctrl+Z
			</button>

			<div class="divider"></div>

			<button
				onclick={() => toggleModifier('ctrl')}
				class="toggle-btn"
				class:active={activeModifiers.ctrl}
				title="Strg (Ctrl) für nächste Taste gedrückt halten"
			>
				Ctrl
			</button>

			<button
				onclick={() => toggleModifier('alt')}
				class="toggle-btn"
				class:active={activeModifiers.alt}
				title="Alt für nächste Taste gedrückt halten"
			>
				Alt
			</button>

			<button
				onclick={() => toggleModifier('super')}
				class="toggle-btn"
				class:active={activeModifiers.super}
				title="Windows-Taste (Win) für nächste Taste gedrückt halten"
			>
				Win
			</button>

			<button
				onclick={() => toggleModifier('shift')}
				class="toggle-btn"
				class:active={activeModifiers.shift}
				title="Shift für nächste Taste gedrückt halten"
			>
				Shift
			</button>

			<div class="divider"></div>

			<button onclick={() => sendTerminalString('\x1b')} class="action-btn" title="Escape senden">
				Esc
			</button>

			<button onclick={() => sendTerminalString('\t')} class="action-btn" title="Tabulator senden">
				Tab
			</button>
		</div>
	</div>
</div>

<style>
	.xterm-container {
		position: relative;
		width: 100%;
		overflow: hidden;
		border-radius: 8px;
		background: #1a1a1a;
	}

	.terminal-wrapper {
		width: 100%;
		height: 100%;
		overflow: hidden;
		padding: 8px;
	}

	.sidebar-container {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%) translateX(-100%);
		z-index: 50;
		display: flex;
		align-items: center;
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.sidebar-container.expanded {
		transform: translateY(-50%) translateX(0);
	}

	.sidebar-handle {
		position: absolute;
		left: 100%;
		top: 50%;
		transform: translateY(-50%);
		width: 24px;
		height: 60px;
		background: #262626;
		border: 1px solid rgba(16, 185, 129, 0.3);
		border-left: none;
		border-radius: 0 8px 8px 0;
		color: #10b981;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 4px 0 15px rgba(0, 0, 0, 0.3);
	}

	.sidebar-handle:hover {
		background: rgba(16, 185, 129, 0.1);
		color: #34d399;
		border-color: rgba(52, 211, 153, 0.5);
	}

	.sidebar-content {
		width: 110px;
		background: #262626;
		border: 1px solid rgba(16, 185, 129, 0.3);
		border-left: none;
		border-radius: 0 12px 12px 0;
		padding: 16px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		box-shadow: 4px 0 25px rgba(0, 0, 0, 0.5);
	}

	.sidebar-title {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
		text-align: center;
		margin-bottom: 4px;
	}

	.divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.08);
		margin: 4px 0;
	}

	.action-btn,
	.toggle-btn {
		width: 100%;
		padding: 8px 4px;
		font-size: 11px;
		font-weight: 600;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: center;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.action-btn {
		background: rgba(255, 255, 255, 0.03);
		color: #e5e7eb;
	}

	.action-btn:hover {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
		border-color: rgba(16, 185, 129, 0.3);
	}

	.toggle-btn {
		background: rgba(255, 255, 255, 0.03);
		color: #9ca3af;
	}

	.toggle-btn:hover {
		background: rgba(255, 255, 255, 0.07);
		color: #f3f4f6;
	}

	.toggle-btn.active {
		background: rgba(16, 185, 129, 0.2);
		color: #34d399;
		border-color: rgba(16, 185, 129, 0.6);
		box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
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
