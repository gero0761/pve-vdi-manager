<script lang="ts">
	let { data } = $props();
</script>

<div class="flex min-h-screen flex-col bg-gray-900 text-white">
	<!-- Top Navigation Header -->
	<header class="flex w-full items-center justify-between px-6 py-6 lg:px-12">
		<!-- GitHub Link (Left) -->
		<a
			href="https://github.com/gero0761/pve-vdi-manager"
			target="_blank"
			class="flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
			title="View on GitHub"
		>
			<svg class="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.11.81 2.235 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
				/>
			</svg>
			<span class="hidden font-medium sm:block">GitHub</span>
		</a>

		<!-- Auth Links (Right) -->
		<div class="flex items-center space-x-6">
			{#if data.user}
				<div class="flex items-center space-x-4">
					<span class="hidden text-sm text-gray-400 sm:block">
						Logged in as <span class="font-medium text-white">{data.user.username}</span>
					</span>
					<form action="/logout">
						<button
							type="submit"
							class="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-500 hover:text-white"
						>
							Logout
						</button>
					</form>
				</div>
			{:else}
				<div class="flex items-center space-x-4 sm:space-x-8">
					<a
						href="/register"
						class="text-sm font-medium text-gray-400 transition-colors hover:text-white"
						>Register</a
					>
					<a
						href="/login"
						class="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
						>Login</a
					>
				</div>
			{/if}
		</div>
	</header>

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
				<!-- Admin Card -->
				<a
					href="/admin"
					class="group flex flex-col space-y-4 rounded-2xl bg-gray-800 p-8 shadow-2xl transition-all hover:bg-gray-750 border border-gray-700 hover:border-indigo-500"
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
					<h3 class="text-2xl font-bold text-white">Admin Dashboard</h3>
					<p class="text-gray-400">
						Deploy new clones, manage VM status, and monitor your entire cluster from a single view.
					</p>
				</a>

				<!-- Console Card -->
				<a
					href="/console"
					class="group flex flex-col space-y-4 rounded-2xl bg-gray-800 p-8 shadow-2xl transition-all hover:bg-gray-750 border border-gray-700 hover:border-indigo-500"
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