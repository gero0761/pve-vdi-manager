<script lang="ts">
	import { enhance } from '$app/forms';
	let { form, data } = $props();

	let loading = $state(false);
</script>

<svelte:head>
	<title>Profile - PVE VDI</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
	<header class="mb-10">
		<h1 class="text-3xl font-extrabold tracking-tight text-white">Your Profile</h1>
		<p class="mt-2 text-sm text-gray-400">Manage your account settings and change your password.</p>
	</header>

	{#if form?.error}
		<div class="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400">
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div class="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-400">
			Password changed successfully.
		</div>
	{/if}

	<div class="overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-xl">
		<div class="border-b border-gray-700 bg-gray-800/50 px-6 py-4">
			<h3 class="text-lg font-bold text-white">Change Password</h3>
		</div>
		<form
			method="POST"
			action="?/changePassword"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
			class="p-6 space-y-6"
		>
			<div class="space-y-1.5">
				<label for="currentPassword" class="block text-xs font-bold text-gray-400 uppercase tracking-tight">Current Password</label>
				<input
					type="password"
					id="currentPassword"
					name="currentPassword"
					required
					class="w-full rounded-xl border border-gray-700 bg-gray-900 py-2.5 px-4 text-gray-200 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
				/>
			</div>

			<div class="space-y-1.5">
				<label for="newPassword" class="block text-xs font-bold text-gray-400 uppercase tracking-tight">New Password</label>
				<input
					type="password"
					id="newPassword"
					name="newPassword"
					required
					class="w-full rounded-xl border border-gray-700 bg-gray-900 py-2.5 px-4 text-gray-200 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
				/>
			</div>

			<div class="space-y-1.5">
				<label for="confirmPassword" class="block text-xs font-bold text-gray-400 uppercase tracking-tight">Confirm New Password</label>
				<input
					type="password"
					id="confirmPassword"
					name="confirmPassword"
					required
					class="w-full rounded-xl border border-gray-700 bg-gray-900 py-2.5 px-4 text-gray-200 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
				/>
			</div>

			<div class="pt-4 flex justify-end">
				<button
					type="submit"
					disabled={loading}
					class="rounded-xl bg-indigo-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
				>
					{#if loading}
						Updating...
					{:else}
						Update Password
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
