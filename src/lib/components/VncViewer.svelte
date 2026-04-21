<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface RFBClient {
		scaleViewport: boolean;
		resizeSession: boolean;
		addEventListener(type: string, listener: (e: CustomEvent) => void): void;
		disconnect(): void;
	}

	let { url, password, height = '600px' }: { url: string; password?: string; height?: string } = $props();
	let canvasContainer: HTMLDivElement | undefined = $state();
	let rfb: RFBClient | null = $state(null);

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

	onDestroy(() => {
		if (rfb) rfb.disconnect();
	});
</script>

<div bind:this={canvasContainer} class="vnc-wrapper" style="height: {height}"></div>

<style>
	.vnc-wrapper {
		width: 100%;
		background: #1a1a1a;
		border-radius: 8px;
		overflow: hidden;
	}
</style>
