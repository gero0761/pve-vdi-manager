<script lang="ts">
	import { page } from '$app/state';
	import Navmenu from '$lib/components/Navmenu.svelte';
	let { data, children } = $props();
</script>

<div class="flex min-h-screen flex-col bg-gray-900 text-white font-sans">
	<!-- Top App Header -->
	<Navmenu user={data.user} pathname={page.url.pathname} variant="app" />

	<!-- Main App Content -->
	<main class="flex-1">
		{@render children()}
	</main>
</div>
