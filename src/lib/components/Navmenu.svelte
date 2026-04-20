<script lang="ts">
	import { page } from '$app/state';
	import Github from '$lib/components/Github.svelte';
	import User from '$lib/components/User.svelte';

	interface User {
		username: string;
		role?: string;
	}

	let {
		user = null,
		pathname = '',
		variant = 'app'
	}: {
		user?: User | null;
		pathname?: string;
		variant?: 'landing' | 'app';
	} = $props();
</script>


<!-- Top Navigation Header (Landing) -->
<header class="flex w-full items-center justify-between px-6 py-2 lg:px-12">
    <!-- GitHub Link (Left) -->
    <div class="flex items-center gap-6">
        {#if variant === 'landing'}
        <Github>GitHub</Github>
        {:else if variant === 'app'}
        <a href="/" class="flex items-center transition-transform hover:scale-105">
            <img src="/favicon.svg" alt="PVE VDI" class="h-10 w-auto" />
        </a>
        <!-- Desktop Nav -->
        <nav class="hidden space-x-2 md:flex">
            <a
                href="/dashboard"
                class="rounded-lg px-3 py-2 text-sm font-medium transition-colors {pathname === '/dashboard'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'}"
            >
                Dashboard
            </a>
            {#if user && user.role === 'admin'}
            <a
                href="/mgmt/users"
                class="rounded-lg px-3 py-2 text-sm font-medium transition-colors {pathname.startsWith('/mgmt/users')
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'}"
            >
                Users
            </a>
            {/if}
            <a
                href="/console"
                class="rounded-lg px-3 py-2 text-sm font-medium transition-colors {pathname === '/console'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'}"
            >
                Console
            </a>
        </nav>
        <!-- Mobile Nav -->
        <nav class="flex w-full justify-around border-b border-gray-800 bg-gray-900 py-3 md:hidden">
            <a
                href="/dashboard"
                class="text-xs font-bold uppercase tracking-widest {pathname === '/dashboard'
                    ? 'text-indigo-500'
                    : 'text-gray-500'}">Dashboard</a
            >
            {#if user && user.role === 'admin'}
            <a
                href="/mgmt/users"
                class="text-xs font-bold uppercase tracking-widest {pathname.startsWith('/mgmt/users')
                    ? 'text-rose-500'
                    : 'text-gray-500'}">Users</a
            >
            {/if}
            <a
                href="/console"
                class="text-xs font-bold uppercase tracking-widest {pathname === '/console'
                    ? 'text-emerald-500'
                    : 'text-gray-500'}">Console</a
            >
        </nav>
        {/if}
    
    </div>

    <!-- Auth Links (Right) -->
    <div class="flex items-center space-x-6">
        {#if user}
            <div class="flex items-center space-x-4">
                <User user={user} />
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


