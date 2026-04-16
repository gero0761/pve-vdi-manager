<script lang="ts">
	import { enhance } from '$app/forms';
	let loading = false;
	let form = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md space-y-8 rounded-xl bg-gray-800 p-8 shadow-2xl">
		<div>
			<h2 class="mt-2 text-center text-3xl font-extrabold tracking-tight text-white">
				Create Account
			</h2>
			<p class="mt-2 text-center text-sm text-gray-400">
				Or
				<a href="/login" class="font-medium text-indigo-500 hover:text-indigo-400 transition-colors">
					Login here
				</a>
			</p>
		</div>

		{#if form?.error}
			<div class="rounded-md bg-red-500/10 p-4 border border-red-500/50">
				<div class="flex">
					<div class="ml-3">
						<h3 class="text-sm font-medium text-red-400">An error occurred</h3>
						<div class="mt-2 text-sm text-red-300">
							<p>{form.error}</p>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
			class="mt-8 space-y-6"
		>
			<div class="-space-y-px rounded-md shadow-sm">
				<div class="flex gap-2">
					<div class="flex-1">
						<label for="firstName" class="sr-only">First Name</label>
						<input
							id="firstName"
							name="firstName"
							type="text"
							required
							value={form?.firstName ?? ''}
							class="relative block w-full rounded-t-md border-0 bg-gray-700 py-2.5 px-3 text-white ring-1 ring-inset ring-gray-600 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
							placeholder="First Name"
						/>
					</div>
					<div class="flex-1">
						<label for="lastName" class="sr-only">Last Name</label>
						<input
							id="lastName"
							name="lastName"
							type="text"
							required
							value={form?.lastName ?? ''}
							class="relative block w-full rounded-t-md border-0 bg-gray-700 py-2.5 px-3 text-white ring-1 ring-inset ring-gray-600 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
							placeholder="Last Name"
						/>
					</div>
				</div>
				<div>
					<label for="username" class="sr-only">Username</label>
					<input
						id="username"
						name="username"
						type="text"
						required
						value={form?.username ?? ''}
						class="relative block w-full border-0 bg-gray-700 py-2.5 px-3 text-white ring-1 ring-inset ring-gray-600 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
						placeholder="Username"
					/>
				</div>
				<div>
					<label for="password" class="sr-only">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						class="relative block w-full border-0 bg-gray-700 py-2.5 px-3 text-white ring-1 ring-inset ring-gray-600 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
						placeholder="Password"
					/>
				</div>
				<div>
					<label for="passwordConfirm" class="sr-only">Confirm Password</label>
					<input
						id="passwordConfirm"
						name="passwordConfirm"
						type="password"
						required
						class="relative block w-full rounded-b-md border-0 bg-gray-700 py-2.5 px-3 text-white ring-1 ring-inset ring-gray-600 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
						placeholder="Confirm Password"
					/>
				</div>
			</div>

			<div>
				<button
					type="submit"
					disabled={loading}
					class="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{#if loading}
						<svg
							class="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Processing...
					{:else}
						Register
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
