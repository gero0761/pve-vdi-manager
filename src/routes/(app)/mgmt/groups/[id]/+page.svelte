<script lang="ts">
	import { enhance } from '$app/forms';
	import SpinningCircle from '$lib/components/SpinningCircle.svelte';
	import type { UserGroup, GroupType, GroupMember, User, VDIInstance, PermissionType, InstancePermission } from '$lib/server/db/types';

	interface Props {
		data: {
			group: UserGroup & { type: GroupType };
			members: GroupMember[];
			parentGroups: UserGroup[];
			allUsers: User[];
			allGroups: (UserGroup & { type: GroupType })[];
			allInstances: VDIInstance[];
			permissionTypes: PermissionType[];
			groupPerms: (InstancePermission & { instance_vmid: number; permission_name: string; isProtected: boolean })[];
			availableParents: (UserGroup & { type: GroupType })[];
		};
		form: any;
	}

	let { data, form }: Props = $props();

	let activeTab = $state<'members' | 'permissions'>('members');
	let processingParentId = $state<string | null>(null);
	let processingMemberId = $state<string | null>(null);
	let processingPermissionId = $state<string | null>(null);
	let isSavingSettings = $state(false);
	let isAddingMember = $state(false);
	let isGrantingPermission = $state(false);
	let isAddingToGroup = $state(false);

	const typeStyles: Record<number, string> = {
		0: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
		1: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
		2: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
		3: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
		4: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
		5: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
	};
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<div class="mb-10">
		<a href="/mgmt/groups" class="text-sm font-bold text-amber-500 hover:text-amber-400 transition-colors">
			← Back to Groups
		</a>
		<div class="mt-4 flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-extrabold tracking-tight text-white">{data.group.name}</h1>
				<p class="mt-2 text-sm text-gray-400">{data.group.description || 'No description'}</p>
			</div>
			<div class="flex flex-col items-end gap-2">
				<span class="rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-widest border {typeStyles[data.group.type_id] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}">
					{data.group.type?.name || 'Unknown'}
				</span>
			</div>
		</div>
	</div>

	{#if form?.error}
		<div class="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400">
			{form.error}
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
		<!-- Sidebar: Group Settings -->
		<div class="space-y-6">
			<section class="rounded-2xl border border-gray-800 bg-gray-800 p-6 shadow-xl">
				<h3 class="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500">Group Settings</h3>
				<form method="POST" action="?/update" use:enhance={() => {
					isSavingSettings = true;
					return async ({ update }) => {
						isSavingSettings = false;
						await update();
					};
				}} class="space-y-4">
					<div class="space-y-2">
						<label for="name" class="block text-[10px] font-black uppercase tracking-widest text-gray-500">Name</label>
						<input type="text" id="name" name="name" value={data.group.name} required disabled={data.group.type?.is_protected || isSavingSettings} class="w-full rounded-xl border-gray-700 bg-gray-900 py-2.5 px-4 text-sm text-gray-200 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50" />
					</div>
					<div class="space-y-2">
						<label for="description" class="block text-[10px] font-black uppercase tracking-widest text-gray-500">Description</label>
						<textarea id="description" name="description" rows="3" disabled={data.group.type?.is_protected || isSavingSettings} class="w-full rounded-xl border-gray-700 bg-gray-900 py-2.5 px-4 text-sm text-gray-200 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50">{data.group.description || ''}</textarea>
					</div>
					{#if !data.group.type?.is_protected}
						<button type="submit" disabled={isSavingSettings} class="w-full rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-600/20 hover:bg-amber-500 transition-all disabled:opacity-50 flex justify-center items-center gap-2">
							{#if isSavingSettings}
								<SpinningCircle size="h-4 w-4" color="text-white" />
								Saving...
							{:else}
								Save Changes
							{/if}
						</button>
					{:else}
						<p class="text-[10px] text-gray-500 italic text-center">Protected groups cannot be modified.</p>
					{/if}
				</form>
			</section>

			<nav class="flex flex-col gap-2">
				<button 
					onclick={() => activeTab = 'members'}
					class="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-all {activeTab === 'members' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}"
				>
					<span>Members & Nesting</span>
					<span class="rounded-full bg-black/20 px-2 py-0.5 text-[10px]">{data.members.length + data.parentGroups.length}</span>
				</button>
				<button 
					onclick={() => activeTab = 'permissions'}
					class="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-all {activeTab === 'permissions' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}"
				>
					<span>Instance Permissions</span>
					<span class="rounded-full bg-black/20 px-2 py-0.5 text-[10px]">{data.groupPerms.length}</span>
				</button>
			</nav>
		</div>

		<!-- Main Content -->
		<div class="lg:col-span-2">
			{#if activeTab === 'members'}
				<section class="space-y-8">
					<!-- Nested IN these groups -->
					<div class="rounded-2xl border border-gray-800 bg-gray-800 shadow-xl overflow-hidden">
						<div class="border-b border-gray-700 bg-gray-900/50 px-6 py-4">
							<h3 class="text-sm font-bold text-white">Member of (Parent Groups)</h3>
							<p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">This group inherits permissions from these groups</p>
						</div>
						<div class="divide-y divide-gray-700/50">
							{#each data.parentGroups as parent}
								<div class="flex items-center justify-between px-6 py-4 transition-all hover:bg-white/2">
									<div class="flex items-center gap-3">
										<div class="rounded-lg bg-purple-500/10 p-2 text-purple-400">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
										</div>
										<a href="/mgmt/groups/{parent.id}" class="text-sm font-bold text-gray-200 hover:text-amber-500 transition-colors">
											{parent.name}
										</a>
									</div>
									<form method="POST" action="?/removeFromGroup" use:enhance={() => {
										processingParentId = parent.id;
										return async ({ update }) => {
											processingParentId = null;
											await update();
										};
									}}>
										<input type="hidden" name="parentGroupId" value={parent.id} />
										<button 
											type="submit" 
											disabled={!!processingParentId}
											class="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white shadow-lg shadow-red-500/5 transition-all disabled:opacity-50 flex items-center gap-2"
										>
											{#if processingParentId === parent.id}
												<SpinningCircle size="h-3 w-3" color="text-red-400" />
											{/if}
											Remove from Group
										</button>
									</form>
								</div>
							{:else}
								<div class="px-6 py-10 text-center text-gray-500 italic text-sm">
									This group is not a member of any other groups.
								</div>
							{/each}
						</div>
                        {#if !data.group.type?.is_protected && data.availableParents.length > 0}
                            <div class="bg-gray-900/30 px-6 py-4 border-t border-gray-700">
                                <form method="POST" action="?/addToGroup" use:enhance={() => {
									isAddingToGroup = true;
									return async ({ update }) => {
										isAddingToGroup = false;
										await update();
									};
								}} class="flex items-center gap-3">
                                    <select name="parentGroupId" required disabled={isAddingToGroup} class="flex-1 rounded-lg border-gray-700 bg-gray-900 text-sm text-gray-200 focus:border-amber-500 disabled:opacity-50">
                                        <option value="" disabled selected>Add to another group...</option>
                                        {#each data.availableParents as p}
                                            <option value={p.id}>{p.name}</option>
                                        {/each}
                                    </select>
                                    <button type="submit" disabled={isAddingToGroup} class="rounded-lg bg-gray-700 px-4 py-2 text-xs font-bold text-white hover:bg-gray-600 transition-all disabled:opacity-50 min-w-[100px] flex justify-center">
										{#if isAddingToGroup}
											<SpinningCircle size="h-3 w-3" color="text-white" />
										{:else}
											Add to Group
										{/if}
									</button>
                                </form>
                            </div>
                        {/if}
					</div>

					<!-- Members of THIS group -->
					<div class="rounded-2xl border border-gray-800 bg-gray-800 shadow-xl overflow-hidden">
						<div class="border-b border-gray-700 bg-gray-900/50 px-6 py-4">
							<h3 class="text-sm font-bold text-white">Direct Members (Children)</h3>
							<p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">Users and groups that inherit this group's permissions</p>
						</div>
						<div class="divide-y divide-gray-700/50">
							{#each data.members as member}
								<div class="flex items-center justify-between px-6 py-4 transition-all hover:bg-white/2">
									<div class="flex items-center gap-3">
										<div class="rounded-lg p-2 {member.member_type === 'user' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}">
											{#if member.member_type === 'user'}
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
											{/if}
										</div>
										<div>
											<p class="text-sm font-bold text-gray-200">
												{#if member.member_type === 'user'}
													<a href="/mgmt/users/{member.member_id}" class="hover:text-blue-400 transition-colors">
														{data.allUsers.find(u => u.id === member.member_id)?.username || 'Unknown User'}
													</a>
												{:else}
													<a href="/mgmt/groups/{member.member_id}" class="hover:text-amber-400 transition-colors">
														{data.allGroups.find(g => g.id === member.member_id)?.name || 'Unknown Group'}
													</a>
												{/if}
											</p>
										</div>
									</div>
									<form method="POST" action="?/removeMember" use:enhance={() => {
										processingMemberId = member.member_id;
										return async ({ update }) => {
											processingMemberId = null;
											await update();
										};
									}}>
										<input type="hidden" name="memberId" value={member.member_id} />
										<button 
											type="submit" 
											disabled={!!processingMemberId}
											class="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white shadow-lg shadow-red-500/5 transition-all disabled:opacity-50 flex items-center gap-2"
										>
											{#if processingMemberId === member.member_id}
												<SpinningCircle size="h-3 w-3" color="text-red-400" />
											{/if}
											Remove
										</button>
									</form>
								</div>
							{:else}
								<div class="px-6 py-10 text-center text-gray-500 italic text-sm">
									No direct members in this group.
								</div>
							{/each}
						</div>
                        <div class="bg-gray-900/30 p-6 border-t border-gray-700">
                            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <form method="POST" action="?/addMember" use:enhance={() => {
									isAddingMember = true;
									return async ({ update }) => {
										isAddingMember = false;
										await update();
									};
								}} class="space-y-3">
                                    <label class="text-[10px] font-black uppercase tracking-widest text-blue-400" for="addUserSelect">Add User Member</label>
                                    <div class="flex gap-2">
                                        <select id="addUserSelect" name="memberId" required disabled={isAddingMember} class="flex-1 rounded-lg border-gray-700 bg-gray-900 text-xs text-gray-200 focus:border-blue-500 disabled:opacity-50">
                                            <option value="" disabled selected>Select User...</option>
                                            {#each data.allUsers.filter(u => !data.members.some(m => m.member_id === u.id)) as user (user.id)}
                                                <option value={user.id}>{user.username}</option>
                                            {/each}
                                        </select>
                                        <input type="hidden" name="memberType" value="user" />
                                        <button type="submit" disabled={isAddingMember} class="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-all disabled:opacity-50 min-w-[60px] flex justify-center items-center">
											{#if isAddingMember}
												<SpinningCircle size="h-3 w-3" color="text-white" />
											{:else}
												Add
											{/if}
										</button>
                                    </div>
                                </form>

                                <form method="POST" action="?/addMember" use:enhance={() => {
									isAddingMember = true;
									return async ({ update }) => {
										isAddingMember = false;
										await update();
									};
								}} class="space-y-3">
                                    <label class="text-[10px] font-black uppercase tracking-widest text-amber-400" for="addGroupSelect">Add Group Member</label>
                                    <div class="flex gap-2">
                                        <select id="addGroupSelect" name="memberId" required disabled={isAddingMember} class="flex-1 rounded-lg border-gray-700 bg-gray-900 text-xs text-gray-200 focus:border-amber-500 disabled:opacity-50">
                                            <option value="" disabled selected>Select Group...</option>
                                            {#each data.allGroups.filter(g => g.id !== data.group.id && !data.members.some(m => m.member_id === g.id)) as group (group.id)}
                                                <option value={group.id}>{group.name}</option>
                                            {/each}
                                        </select>
                                        <input type="hidden" name="memberType" value="group" />
                                        <button type="submit" disabled={isAddingMember} class="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-500 transition-all disabled:opacity-50 min-w-[60px] flex justify-center items-center">
											{#if isAddingMember}
												<SpinningCircle size="h-3 w-3" color="text-white" />
											{:else}
												Add
											{/if}
										</button>
                                    </div>
                                </form>
                            </div>
                        </div>
					</div>
				</section>
			{:else if activeTab === 'permissions'}
				<section class="space-y-6">
					<div class="rounded-2xl border border-gray-800 bg-gray-800 shadow-xl overflow-hidden">
						<div class="border-b border-gray-700 bg-gray-900/50 px-6 py-4 flex items-center justify-between">
							<h3 class="text-sm font-bold text-white">Instance Permissions</h3>
						</div>
						<div class="divide-y divide-gray-700/50">
							{#each data.groupPerms as perm (perm.instance_id + ':' + perm.permission_type_id)}
								<div class="flex items-center justify-between px-6 py-4 transition-all hover:bg-white/2">
									<div class="flex items-center gap-4">
										<div class="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 21h6l-.75-4M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
										</div>
										<div>
											<p class="text-sm font-bold text-gray-200">Instance: {perm.instance_vmid}</p>
											<p class="text-xs text-gray-500">ID: {perm.instance_id}</p>
										</div>
										<span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-emerald-400 border border-emerald-500/20">
											{perm.permission_name}
										</span>
										{#if perm.isProtected}
											<span class="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-blue-400 border border-blue-500/20">
												Protected
											</span>
										{/if}
									</div>
									<form method="POST" action="?/revokePermission" use:enhance={() => {
										processingPermissionId = `${perm.instance_id}:${perm.permission_type_id}`;
										return async ({ update }) => {
											processingPermissionId = null;
											await update();
										};
									}}>
										<input type="hidden" name="instanceId" value={perm.instance_id} />
										<input type="hidden" name="permissionTypeId" value={perm.permission_type_id} />
										<button 
											type="submit" 
											class="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white shadow-lg shadow-red-500/5 transition-all disabled:opacity-20 flex items-center gap-2" 
											disabled={perm.isProtected || data.group.type?.is_protected || !!processingPermissionId}
											title={perm.isProtected || data.group.type?.is_protected ? "Cannot revoke system-managed permissions" : ""}
										>
											{#if processingPermissionId === `${perm.instance_id}:${perm.permission_type_id}`}
												<SpinningCircle size="h-3 w-3" color="text-red-400" />
											{/if}
											Revoke
										</button>
									</form>
								</div>
							{:else}
								<div class="px-6 py-10 text-center text-gray-500">
									This group has no specific instance permissions.
								</div>
							{/each}
						</div>
					</div>
					{#if !data.group.type?.is_protected}
						<div class="rounded-2xl border border-gray-800 bg-gray-800 p-6 shadow-xl">
							<h3 class="mb-4 text-sm font-bold text-white">Grant New Permission</h3>
							<form method="POST" action="?/grantPermission" use:enhance={() => {
								isGrantingPermission = true;
								return async ({ update }) => {
									isGrantingPermission = false;
									await update();
								};
							}} class="flex flex-wrap items-end gap-4">
								<div class="flex-1 min-w-[200px] space-y-2">
									<label class="block text-[10px] font-black uppercase tracking-widest text-gray-500" for="grantInstanceSelect">Select Instance</label>
									<select id="grantInstanceSelect" name="instanceId" required disabled={isGrantingPermission} class="w-full rounded-lg border-gray-700 bg-gray-900 text-sm text-gray-200 focus:border-emerald-500 disabled:opacity-50">
										{#each data.allInstances as inst (inst.id)}
											<option value={inst.id}>VM {inst.vmid} ({inst.node})</option>
										{/each}
									</select>
								</div>
								<div class="flex-1 min-w-[150px] space-y-2">
									<label class="block text-[10px] font-black uppercase tracking-widest text-gray-500" for="grantTypeSelect">Permission Type</label>
									<select id="grantTypeSelect" name="permissionTypeId" required disabled={isGrantingPermission} class="w-full rounded-lg border-gray-700 bg-gray-900 text-sm text-gray-200 focus:border-emerald-500 disabled:opacity-50">
										{#each data.permissionTypes as type (type.id)}
											<option value={type.id}>{type.name} - {type.description}</option>
										{/each}
									</select>
								</div>
								<button type="submit" disabled={isGrantingPermission} class="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition-all disabled:opacity-50 min-w-[100px] flex justify-center items-center gap-2">
									{#if isGrantingPermission}
										<SpinningCircle size="h-4 w-4" color="text-white" />
										Granting...
									{:else}
										Grant
									{/if}
								</button>
							</form>
						</div>
					{:else}
						<div class="rounded-2xl border border-gray-800 bg-gray-800 p-6 shadow-xl text-center">
							<p class="text-xs text-gray-400 italic">
								Permissions of system-protected groups are automatically managed and cannot be modified.
							</p>
						</div>
					{/if}
				</section>
			{/if}
		</div>
	</div>
</div>
