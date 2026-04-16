<script lang="ts">
	import { page } from '$app/state';
	let { data, children } = $props();
</script>

<div class="flex min-h-screen flex-col bg-gray-900 text-white font-sans">
	<!-- Top App Header -->
	<header class="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-900/80 backdrop-blur-md">
		<div class="mx-auto flex max-w-full items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
			<!-- Left: Logo & Nav -->
			<div class="flex items-center space-x-8">
				<a href="/" class="flex items-center transition-transform hover:scale-105">
					<img src="/favicon.svg" alt="PVE VDI" class="h-10 w-auto" />
				</a>

				<nav class="hidden space-x-4 md:flex">
					<a
						href="/admin"
						class="rounded-lg px-3 py-2 text-sm font-medium transition-colors {page.url.pathname === '/admin'
							? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
							: 'text-gray-400 hover:bg-gray-800 hover:text-white'}"
					>
						Admin
					</a>
					<a
						href="/console"
						class="rounded-lg px-3 py-2 text-sm font-medium transition-colors {page.url.pathname === '/console'
							? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
							: 'text-gray-400 hover:bg-gray-800 hover:text-white'}"
					>
						Console
					</a>
				</nav>
			</div>

			<!-- Right: User Info & Logout -->
			<div class="flex items-center space-x-6">
				<div class="hidden items-center space-x-3 sm:flex">
					<div class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
						</svg>
					</div>
					<div class="flex flex-col text-xs">
						<span class="font-bold text-gray-100">{data.user?.username}</span>
						<span class="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{data.user?.role || 'User'}</span>
					</div>
				</div>

				<form action="/logout" method="POST">
					<button
						type="submit"
						class="group flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500 hover:text-white active:scale-95"
					>
						<svg class="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
						</svg>
						Logout
					</button>
				</form>
			</div>
		</div>
	</header>

	<!-- Mobile Nav (only visible on small screens) -->
	<nav class="flex w-full justify-around border-b border-gray-800 bg-gray-900 py-3 md:hidden">
		<a href="/admin" class="text-xs font-bold uppercase tracking-widest {page.url.pathname === '/admin' ? 'text-indigo-500' : 'text-gray-500'}">Dashboard</a>
		<a href="/console" class="text-xs font-bold uppercase tracking-widest {page.url.pathname === '/console' ? 'text-emerald-500' : 'text-gray-500'}">Console</a>
	</nav>

	<!-- Main App Content -->
	<main class="flex-1">
		{@render children()}
	</main>
</div>

<style>
	:global(body) {
		background-color: #111827; /* Tailwind gray-900 */
		margin: 0;
	}
</style>
