<script lang="ts">
	import { enhance } from '$app/forms';

	interface Credential {
		username: string;
		firstName: string;
		lastName: string;
		password: string;
		role: string;
	}

	interface BulkRow {
		firstName: string;
		lastName: string;
		username: string;
		password: string;
		role: string;
	}

	interface Props {
		/** Whether the currently logged-in user has admin privileges */
		isAdmin: boolean;
		/** Called when the modal should be closed */
		onclose: () => void;
	}

	let { isAdmin, onclose }: Props = $props();

	// ─── Tab state ────────────────────────────────────────────────────────────
	let activeTab = $state<'single' | 'bulk'>('single');

	// ─── Single creation ──────────────────────────────────────────────────────
	let singleUsername = $state('');
	let singlePassword = $state('');
	let singleFirstName = $state('');
	let singleLastName = $state('');
	let singleRole = $state('user');
	let singlePasswordVisible = $state(false);
	let singleError = $state('');

	// ─── Bulk creation ────────────────────────────────────────────────────────
	let bulkRows = $state<BulkRow[]>([
		{ firstName: '', lastName: '', username: '', password: '', role: 'user' }
	]);
	let bulkError = $state('');

	// ─── Credentials view ─────────────────────────────────────────────────────
	let showCredentials = $state(false);
	let createdCredentials = $state<Credential[]>([]);

	// ─── Password generator ───────────────────────────────────────────────────
	// Simple alphanumeric charset — no ambiguous chars (0/O, 1/l/I), no symbols.
	// Good enough for a temporary initial password.
	const CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789';
	const PW_LENGTH = 10;

	function generatePassword(): string {
		const arr = new Uint8Array(PW_LENGTH);
		crypto.getRandomValues(arr);
		return Array.from(arr, (b) => CHARSET[b % CHARSET.length]).join('');
	}

	function generateSinglePassword() {
		singlePassword = generatePassword();
		singlePasswordVisible = true;
	}

	function generateBulkPasswords() {
		bulkRows = bulkRows.map((r) => ({ ...r, password: generatePassword() }));
	}

	function addBulkRow() {
		bulkRows = [...bulkRows, { firstName: '', lastName: '', username: '', password: '', role: 'user' }];
	}

	function removeBulkRow(i: number) {
		bulkRows = bulkRows.filter((_, idx) => idx !== i);
	}

	// ─── Print ────────────────────────────────────────────────────────────────
	function printCredentials() {
	const rows = createdCredentials
		.map(
			(c) => `
			<tr>
				<td>${c.firstName} ${c.lastName}</td>
				<td>${c.username}</td>
				<td>${c.password}</td>
				<td>${c.role}</td>
			</tr>`
		)
		.join('');

	const htmlPrintPage = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>User Credentials</title>

	<style>
		body {
			font-family: Arial, sans-serif;
			margin: 40px;
		}

		h1 {
			margin-bottom: 20px;
		}

		table {
			width: 100%;
			border-collapse: collapse;
		}

		th,
		td {
			border: 1px solid #999;
			padding: 8px;
			text-align: left;
		}

		th {
			background: #eee;
		}

		@media print {
			body {
				margin: 15mm;
			}
		}
	</style>
</head>
<body>

<h1>User Credentials</h1>

<table>
	<thead>
		<tr>
			<th>Name</th>
			<th>Username</th>
			<th>Password</th>
			<th>Role</th>
		</tr>
	</thead>

	<tbody>
		${rows}
	</tbody>
</table>

</body>
</html>
`;

	const win = window.open('', '_blank');

	if (!win) return;

	win.document.write(htmlPrintPage);
	win.document.close();

	win.onload = () => {
		win.focus();
		win.print();
		win.onafterprint = () => win.close();
	};
}
</script>


<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
	<div class="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl flex flex-col max-h-[90vh]">

		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-700 bg-gray-800/80 px-6 py-4 shrink-0">
			<h3 class="text-xl font-bold text-white">
				{showCredentials ? 'Credentials Created' : 'Create User'}
			</h3>
			<button onclick={onclose} class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white transition-all">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- ══════════════════ CREDENTIALS VIEW ══════════════════ -->
		{#if showCredentials}
			<div class="flex flex-col gap-4 p-6 overflow-auto flex-1">
				<div class="flex items-start justify-between gap-4">
					<div>
						<h4 class="text-lg font-bold text-emerald-400">
							{createdCredentials.length} user{createdCredentials.length !== 1 ? 's' : ''} created
						</h4>
						<p class="text-sm text-gray-400 mt-1">
							Passwords are only once shown here — save or print them before closing.
						</p>
					</div>
					<button
						onclick={printCredentials}
						class="flex shrink-0 items-center gap-2 rounded-xl bg-gray-700 px-4 py-2 text-sm font-bold text-white hover:bg-gray-600 transition-all"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
						</svg>
						Print Credentials
					</button>
				</div>

				<div class="overflow-x-auto rounded-xl border border-gray-700">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-700 bg-gray-900/60">
								<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Name</th>
								<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Username</th>
								<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Password</th>
								<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Role</th>
							</tr>
						</thead>
						<tbody>
							{#each createdCredentials as cred, i}
								<tr class="border-b border-gray-700/50 {i % 2 === 0 ? 'bg-gray-800/50' : 'bg-gray-800/20'}">
									<td class="px-4 py-3 text-gray-200">{cred.firstName} {cred.lastName}</td>
									<td class="px-4 py-3 font-mono text-indigo-300">{cred.username}</td>
									<td class="px-4 py-3 font-mono text-amber-300 select-all">{cred.password}</td>
									<td class="px-4 py-3">
										<span class="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide {cred.role === 'admin' ? 'bg-rose-500/20 text-rose-400' : 'bg-gray-700 text-gray-400'}">
											{cred.role}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
			<div class="border-t border-gray-700 px-6 py-4 shrink-0">
				<button onclick={onclose} class="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-500 transition-all">
					Done
				</button>
			</div>

		{:else}
			<!-- ══════════════════ TABS ══════════════════ -->
			<div class="flex border-b border-gray-700 shrink-0">
				<button
					onclick={() => (activeTab = 'single')}
					class="px-6 py-3 text-sm font-bold transition-all {activeTab === 'single'
						? 'border-b-2 border-indigo-500 text-white'
						: 'text-gray-400 hover:text-white'}"
				>Single User</button>
				<button
					onclick={() => (activeTab = 'bulk')}
					class="px-6 py-3 text-sm font-bold transition-all {activeTab === 'bulk'
						? 'border-b-2 border-indigo-500 text-white'
						: 'text-gray-400 hover:text-white'}"
				>Bulk Create</button>
			</div>

			<!-- ══════════════════ SINGLE TAB ══════════════════ -->
			{#if activeTab === 'single'}
				<form
					method="POST"
					action="?/createUser"
					use:enhance={() => {
						singleError = '';
						return async ({ result, update }) => {
							if (result.type === 'failure') {
								singleError = (result.data?.error as string) ?? 'An error occurred';
								return;
							}
							if (result.type === 'success') {
								createdCredentials = [{
									username: singleUsername,
									firstName: singleFirstName,
									lastName: singleLastName,
									password: singlePassword,
									role: singleRole
								}];
								showCredentials = true;
							} else {
								await update();
							}
						};
					}}
					class="flex flex-col flex-1 overflow-hidden"
				>
					<div class="flex-1 overflow-auto p-6 space-y-4">
						{#if singleError}
							<div class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{singleError}</div>
						{/if}

						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-1.5">
								<label class="block text-xs font-bold uppercase tracking-wide text-gray-400">First Name</label>
								<input type="text" name="firstName" required bind:value={singleFirstName} placeholder="Anna"
									class="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
							</div>
							<div class="space-y-1.5">
								<label class="block text-xs font-bold uppercase tracking-wide text-gray-400">Last Name</label>
								<input type="text" name="lastName" required bind:value={singleLastName} placeholder="Schmidt"
									class="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
							</div>
						</div>

						<div class="space-y-1.5">
							<label class="block text-xs font-bold uppercase tracking-wide text-gray-400">Username</label>
							<input type="text" name="username" required bind:value={singleUsername} placeholder="a.schmidt" autocomplete="off"
								class="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
						</div>

						<div class="space-y-1.5">
							<label class="block text-xs font-bold uppercase tracking-wide text-gray-400">Password</label>
							<div class="flex gap-2">
								<input
									type={singlePasswordVisible ? 'text' : 'password'}
									name="password"
									required
									bind:value={singlePassword}
									placeholder="Password"
									autocomplete="new-password"
									class="flex-1 min-w-0 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 font-mono text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
								/>
								<!-- Generate button -->
								<button type="button" onclick={generateSinglePassword} title="Generate random password"
									class="shrink-0 flex items-center gap-1.5 rounded-xl bg-gray-700 px-3 py-2.5 text-xs font-bold text-gray-300 hover:bg-amber-600/30 hover:text-amber-400 transition-all">
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
								</button>
								<!-- Eye toggle -->
								<button type="button" onclick={() => (singlePasswordVisible = !singlePasswordVisible)} title="Toggle visibility"
									class="shrink-0 rounded-xl bg-gray-700 px-3 py-2.5 text-gray-400 hover:bg-gray-600 hover:text-white transition-all">
									{#if singlePasswordVisible}
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
										</svg>
									{:else}
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
										</svg>
									{/if}
								</button>
							</div>
						</div>

						{#if isAdmin}
							<div class="space-y-1.5">
								<label class="block text-xs font-bold uppercase tracking-wide text-gray-400">Role</label>
								<select name="role" bind:value={singleRole}
									class="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-gray-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
									<option value="user">User</option>
									<option value="admin">Admin</option>
								</select>
							</div>
						{:else}
							<input type="hidden" name="role" value="user" />
						{/if}
					</div>

					<div class="border-t border-gray-700 flex gap-3 px-6 py-4 shrink-0">
						<button type="button" onclick={onclose} class="flex-1 rounded-xl bg-gray-700 py-3 font-bold text-white hover:bg-gray-600 transition-all">Cancel</button>
						<button type="submit" class="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all">Create User</button>
					</div>
				</form>

			<!-- ══════════════════ BULK TAB ══════════════════ -->
			{:else}
				<div class="flex flex-col flex-1 overflow-hidden">
					<div class="flex items-center justify-between gap-3 px-6 pt-5 pb-3 shrink-0">
						<p class="text-sm text-gray-400">Fill in the table. Passwords left empty will not be generated automatically.</p>
						<div class="flex gap-2 shrink-0">
							<button type="button" onclick={generateBulkPasswords}
								class="flex items-center gap-1.5 rounded-lg bg-amber-600/20 px-3 py-1.5 text-xs font-bold text-amber-400 border border-amber-600/30 hover:bg-amber-600 hover:text-white transition-all">
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
								Generate All Passwords
							</button>
							<button type="button" onclick={addBulkRow}
								class="flex items-center gap-1.5 rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-bold text-indigo-400 border border-indigo-600/30 hover:bg-indigo-600 hover:text-white transition-all">
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
								</svg>
								Add Row
							</button>
						</div>
					</div>

					{#if bulkError}
						<div class="mx-6 mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 shrink-0">{bulkError}</div>
					{/if}

					<div class="flex-1 overflow-auto px-6 pb-2">
						<div class="overflow-x-auto rounded-xl border border-gray-700">
							<table class="w-full min-w-[640px] text-sm">
								<thead>
									<tr class="border-b border-gray-700 bg-gray-900/60">
										<th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">First Name</th>
										<th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">Last Name</th>
										<th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">Username</th>
										<th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">Password</th>
										{#if isAdmin}
											<th class="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">Role</th>
										{/if}
										<th class="w-8"></th>
									</tr>
								</thead>
								<tbody>
									{#each bulkRows as row, i}
										<tr class="border-b border-gray-700/50 hover:bg-gray-700/20 group">
											<td class="px-2 py-1.5">
												<input type="text" bind:value={row.firstName} placeholder="First"
													class="w-full rounded-lg border border-transparent bg-gray-900 px-2.5 py-1.5 text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 group-hover:border-gray-700" />
											</td>
											<td class="px-2 py-1.5">
												<input type="text" bind:value={row.lastName} placeholder="Last"
													class="w-full rounded-lg border border-transparent bg-gray-900 px-2.5 py-1.5 text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 group-hover:border-gray-700" />
											</td>
											<td class="px-2 py-1.5">
												<input type="text" bind:value={row.username} placeholder="username"
													class="w-full rounded-lg border border-transparent bg-gray-900 px-2.5 py-1.5 font-mono text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 group-hover:border-gray-700" />
											</td>
											<td class="px-2 py-1.5">
												<div class="flex gap-1">
													<input type="text" bind:value={row.password} placeholder="Password"
														class="flex-1 min-w-0 rounded-lg border border-transparent bg-gray-900 px-2.5 py-1.5 font-mono text-xs text-amber-300 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 group-hover:border-gray-700" />
													<button type="button" onclick={() => (bulkRows[i] = { ...row, password: generatePassword() })} title="Generate"
														class="shrink-0 rounded-lg bg-gray-800 p-1.5 text-gray-500 hover:bg-amber-600/20 hover:text-amber-400 transition-all">
														<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
														</svg>
													</button>
												</div>
											</td>
											{#if isAdmin}
												<td class="px-2 py-1.5">
													<select bind:value={row.role}
														class="w-full rounded-lg border border-transparent bg-gray-900 px-2 py-1.5 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none group-hover:border-gray-700">
														<option value="user">User</option>
														<option value="admin">Admin</option>
													</select>
												</td>
											{/if}
											<td class="pr-2 py-1.5">
												<button type="button" onclick={() => removeBulkRow(i)} disabled={bulkRows.length <= 1}
													class="rounded-lg p-1.5 text-gray-600 hover:bg-red-600/20 hover:text-red-400 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
													<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
													</svg>
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<div class="border-t border-gray-700 flex gap-3 px-6 py-4 shrink-0">
						<button type="button" onclick={onclose} class="flex-1 rounded-xl bg-gray-700 py-3 font-bold text-white hover:bg-gray-600 transition-all">Cancel</button>
						<form
							method="POST"
							action="?/bulkCreate"
							use:enhance={({ formData }) => {
								bulkError = '';
								formData.set('users', JSON.stringify(bulkRows));
								return async ({ result }) => {
									if (result.type === 'failure') {
										bulkError = (result.data?.error as string) ?? 'An error occurred';
										return;
									}
									if (result.type === 'success' && result.data && 'created' in result.data) {
										createdCredentials = result.data.created as Credential[];
										showCredentials = true;
									}
								};
							}}
							class="flex-1"
						>
							<input type="hidden" name="users" value="" />
							<button type="submit" class="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all">
								Create {bulkRows.length} User{bulkRows.length !== 1 ? 's' : ''}
							</button>
						</form>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
