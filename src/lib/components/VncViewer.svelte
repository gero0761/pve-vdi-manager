<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	// @ts-expect-error (noVNC hat oft unvollständige Typen)
	import RFB from '@novnc/novnc/core/rfb';

	interface RFBClient {
		scaleViewport: boolean;
		resizeSession: boolean;
		addEventListener(type: string, listener: (e: CustomEvent) => void): void;
		disconnect(): void;
	}

	let { url }: { url: string } = $props();
	let canvasContainer: HTMLDivElement | undefined = $state();
	let rfb: RFBClient | null = $state(null);

	onMount(() => {
		if (url && canvasContainer) {
			const client = new RFB(canvasContainer, url, {
				credentials: { password: '' } // PVE Tickets brauchen meist kein PW hier
			});

			client.scaleViewport = true;
			client.resizeSession = true;

			client.addEventListener('connect', () => console.log('VNC Verbunden'));
			client.addEventListener('disconnect', (e: CustomEvent) => console.log('VNC Getrennt', e.detail.clean));

			rfb = client;
		}
	});

	onDestroy(() => {
		if (rfb) rfb.disconnect();
	});
</script>

<div bind:this={canvasContainer} class="vnc-wrapper"></div>

<style>
	.vnc-wrapper {
		width: 100%;
		height: 600px;
		background: #1a1a1a;
		border-radius: 8px;
		overflow: hidden;
	}
</style>