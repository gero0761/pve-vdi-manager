<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import KeyTable from '$lib/novnc/core/input/keysym.js';

	interface RFBClient {
		scaleViewport: boolean;
		resizeSession: boolean;
		addEventListener(type: string, listener: (e: CustomEvent) => void): void;
		disconnect(): void;
		sendCtrlAltDel(): void;
		sendKey(keysym: number, code: string, down?: boolean): void;
		focus(options?: FocusOptions): void;
	}

	let { url, password, height = '600px' }: { url: string; password?: string; height?: string } = $props();
	let canvasContainer: HTMLDivElement | undefined = $state();
	let rfb: RFBClient | null = $state(null);

	let isExpanded = $state(false);
	let activeModifiers = $state({
		ctrl: false,
		alt: false,
		super: false,
		shift: false
	});

	onMount(async () => {
		if (url && canvasContainer) {
			const { default: RFB } = await import('$lib/novnc/core/rfb.js');

			const client = new RFB(canvasContainer, url, {
				credentials: { password: password || '' }
			});

			client.scaleViewport = true;
			client.resizeSession = true;

			client.addEventListener('connect', () => console.log('VNC Connected'));
			client.addEventListener('disconnect', (e: CustomEvent) =>
				console.log('VNC Disconnected', e.detail.clean)
			);

			rfb = client;
		}
	});

	function sendCAD() {
		if (!rfb) return;
		rfb.sendCtrlAltDel();
		rfb.focus();
	}

	function toggleModifier(name: 'ctrl' | 'alt' | 'super' | 'shift', keysym: number, code: string) {
		if (!rfb) return;
		activeModifiers[name] = !activeModifiers[name];
		rfb.sendKey(keysym, code, activeModifiers[name]);
		rfb.focus();
	}

	function pressKey(keysym: number, code: string) {
		if (!rfb) return;
		rfb.sendKey(keysym, code, true);
		rfb.sendKey(keysym, code, false);
		rfb.focus();
	}

	onDestroy(() => {
		if (rfb) {
			// Release any active modifier keys to avoid sticking them on the remote side
			if (activeModifiers.ctrl) rfb.sendKey(KeyTable.XK_Control_L, 'ControlLeft', false);
			if (activeModifiers.alt) rfb.sendKey(KeyTable.XK_Alt_L, 'AltLeft', false);
			if (activeModifiers.super) rfb.sendKey(KeyTable.XK_Super_L, 'MetaLeft', false);
			if (activeModifiers.shift) rfb.sendKey(KeyTable.XK_Shift_L, 'ShiftLeft', false);
			rfb.disconnect();
		}
	});
</script>

<div class="vnc-container" style="height: {height}">
	<div bind:this={canvasContainer} class="vnc-wrapper"></div>

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

			<button onclick={sendCAD} class="action-btn" title="Ctrl+Alt+Entf an VM senden">
				Ctrl+Alt+Del
			</button>

			<div class="divider"></div>

			<button
				onclick={() => toggleModifier('ctrl', KeyTable.XK_Control_L, 'ControlLeft')}
				class="toggle-btn"
				class:active={activeModifiers.ctrl}
				title="Steuerung (Ctrl) gedrückt halten"
			>
				Ctrl
			</button>

			<button
				onclick={() => toggleModifier('alt', KeyTable.XK_Alt_L, 'AltLeft')}
				class="toggle-btn"
				class:active={activeModifiers.alt}
				title="Wechseltaste (Alt) gedrückt halten"
			>
				Alt
			</button>

			<button
				onclick={() => toggleModifier('super', KeyTable.XK_Super_L, 'MetaLeft')}
				class="toggle-btn"
				class:active={activeModifiers.super}
				title="Windows-Taste (Super) gedrückt halten"
			>
				Win
			</button>

			<button
				onclick={() => toggleModifier('shift', KeyTable.XK_Shift_L, 'ShiftLeft')}
				class="toggle-btn"
				class:active={activeModifiers.shift}
				title="Umschalttaste (Shift) gedrückt halten"
			>
				Shift
			</button>

			<div class="divider"></div>

			<button onclick={() => pressKey(KeyTable.XK_Escape, 'Escape')} class="action-btn" title="Escape-Taste senden">
				Esc
			</button>

			<button onclick={() => pressKey(KeyTable.XK_Tab, 'Tab')} class="action-btn" title="Tabulator-Taste senden">
				Tab
			</button>
		</div>
	</div>
</div>

<style>
	.vnc-container {
		position: relative;
		width: 100%;
		overflow: hidden;
		border-radius: 8px;
		background: #1a1a1a;
	}

	.vnc-wrapper {
		width: 100%;
		height: 100%;
		overflow: hidden;
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
</style>
