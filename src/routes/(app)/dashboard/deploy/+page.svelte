<script lang="ts">
	import { goto } from '$app/navigation';
	import SpinningCircle from '$lib/components/SpinningCircle.svelte';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/dashboard');
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400">
	<span class="animate-pulse font-medium text-sm"><SpinningCircle size="sm" />Redirecting to Dashboard...</span>
</div>
