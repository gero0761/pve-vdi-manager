<script lang="ts">
	import Navmenu from '$lib/components/Navmenu.svelte';
	let { data } = $props();
</script>

<div class="flex min-h-screen flex-col bg-gray-900 text-white">
	<!-- Top Navigation Header -->
	<Navmenu user={data.user} variant="landing" />

	<!-- Main Content Section -->
	<main class="flex flex-1 flex-col items-center justify-center px-4 pb-12">
		<div class="w-full max-w-4xl">
			<!-- Logo Section -->
			<div class="flex flex-col items-center text-center">
				<img src="/pve-vdi-logo.svg" alt="PVE VDI Manager" class="h-48 w-auto mb-8" />
				<h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
					Proxmox VDI Manager
				</h1>
				<p class="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
					Easily manage, deploy, and access your virtual desktop infrastructure on Proxmox VE.
				</p>
			</div>

			<!-- Navigation Grid -->
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
				<!-- Dashboard Card -->
				<a
					href="/dashboard"
					class="group flex flex-col space-y-4 rounded-2xl bg-gray-800 p-8 shadow-2xl transition-all hover:bg-gray-750 border border-gray-700 hover:border-indigo-500"
					data-sveltekit-reload
				>
					<div
						class="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600 group-hover:bg-indigo-500 transition-colors"
					>
						<svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
					</div>
					<h3 class="text-2xl font-bold text-white">VDI Dashboard</h3>
					<p class="text-gray-400">
						Manage your VDI instances, monitor VM status, and access your desktops from a single view.
					</p>
				</a>

				<!-- Console Card -->
				<a
					href="/console"
					class="group flex flex-col space-y-4 rounded-2xl bg-gray-800 p-8 shadow-2xl transition-all hover:bg-gray-750 border border-gray-700 hover:border-indigo-500"
					data-sveltekit-reload
				>
					<div
						class="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 group-hover:bg-emerald-500 transition-colors"
					>
						<svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
							/>
						</svg>
					</div>
					<h3 class="text-2xl font-bold text-white">Instance Console</h3>
					<p class="text-gray-400">
						Directly access your virtual desktops via noVNC or XTermjs without installing any local
						clients.
					</p>
				</a>
			</div>
		</div>
	</main>
</div>

<style>
	/* Custom hover color for gray cards */
	.bg-gray-750 {
		background-color: #262f3f;
	}
</style>