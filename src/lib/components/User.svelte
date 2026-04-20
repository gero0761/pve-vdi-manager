<script lang="ts">
    interface User {
		username: string;
		role?: string;
	}

    let { user }: { user?: User | null } = $props();
</script>

<div class="hidden items-center space-x-3 sm:flex">
    <div class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    </div>
    <div class="flex flex-col text-xs">
        <span class="font-bold text-gray-100">{user?.username}</span>
        <span class="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{user?.role || 'User'}</span>
    </div>
</div>