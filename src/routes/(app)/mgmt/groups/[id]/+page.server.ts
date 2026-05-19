import { db } from '$lib/server/db';
import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const group = await db.getGroupDetailedById(params.id);
	if (!group) throw error(404, 'Group not found');

	const members = await db.getGroupMembers(params.id);
    const parentGroups = await db.getGroupsWhereMember(params.id, 'group');
	const allUsers = await db.getAllUsers();
	const allGroups = await db.getAllGroupsDetailed();
	const allInstances = await db.getAllInstances();
	const permissionTypes = await db.getAllPermissionTypes();
	
	const groupPerms = [];
	const isProtectedGroup = !!group.type?.is_protected;

	for(const inst of allInstances) {
		const perms = await db.getInstancePermissions(inst.id);
		for(const p of perms) {
			if (p.group_id === group.id) {
				groupPerms.push({
					...p,
					instance_vmid: inst.vmid,
					permission_name: permissionTypes.find(pt => pt.id === p.permission_type_id)?.name,
					isProtected: isProtectedGroup
				});
			}
		}
	}

	// Available groups to be added TO (parents)
	// Rule: Cannot add a system group to another group
	const availableParents = isProtectedGroup ? [] : allGroups.filter(
		g => g.id !== group.id && !parentGroups.some(pg => pg.id === g.id)
	);

	return {
		group,
		members,
		parentGroups,
		allUsers,
		// Groups that can be added AS MEMBERS (children)
		allGroups: allGroups.filter(g => g.id !== group.id && !g.type?.is_protected),
		allInstances,
		permissionTypes,
		groupPerms,
		isProtectedGroup,
		availableParents
	};
};

export const actions: Actions = {
	update: async ({ params, request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);
		const data = await request.formData();
		const name = data.get('name') as string;
		const description = data.get('description') as string;
		if (!name) return fail(400, { error: 'Name is required' });

		const group = await db.getGroupById(params.id);
		if (group?.type_id === 1) {
			return fail(400, { error: 'Cannot update a system access group.' });
		}

		try {
			await db.updateGroup(params.id, { name, description });
			return { success: true };
		} catch (err: any) {
			if (err.message?.includes('UNIQUE') || err.message?.includes('Duplicate entry')) {
				return fail(400, { error: 'A group with this name already exists.' });
			}
			return fail(400, { error: 'Failed to update group' });
		}
	},
	addMember: async ({ params, request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);
		const data = await request.formData();
		const memberId = data.get('memberId') as string;
		const memberType = data.get('memberType') as 'user' | 'group';
		try {
			await db.addMemberToGroup(params.id, memberId, memberType);
			return { success: true };
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : 'Failed to add member' });
		}
	},
	addToGroup: async ({ params, request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);
		const data = await request.formData();
		const parentGroupId = data.get('parentGroupId') as string;
		try {
			await db.addMemberToGroup(parentGroupId, params.id, 'group');
			return { success: true };
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : 'Failed to add to group' });
		}
	},
	removeMember: async ({ params, request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);
		const data = await request.formData();
		const memberId = data.get('memberId') as string;
		await db.removeMemberFromGroup(params.id, memberId);
		return { success: true };
	},
	removeFromGroup: async ({ params, request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);
		const data = await request.formData();
		const parentGroupId = data.get('parentGroupId') as string;
		await db.removeMemberFromGroup(parentGroupId, params.id);
		return { success: true };
	},
	grantPermission: async ({ params, request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);
		const group = await db.getGroupDetailedById(params.id);
		if (!group) return fail(404, { error: 'Group not found' });
		if (group.type?.is_protected) {
			return fail(400, { error: 'Cannot grant permissions to a protected group.' });
		}
		const data = await request.formData();
		const instanceId = data.get('instanceId') as string;
		const permissionTypeId = parseInt(data.get('permissionTypeId') as string);
		await db.grantPermission(params.id, instanceId, permissionTypeId);
		return { success: true };
	},
	revokePermission: async ({ params, request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);
		const group = await db.getGroupDetailedById(params.id);
		if (!group) return fail(404, { error: 'Group not found' });
		if (group.type?.is_protected) {
			return fail(400, { error: 'Cannot revoke permissions from a protected group.' });
		}
		const data = await request.formData();
		const instanceId = data.get('instanceId') as string;
		const permissionTypeId = parseInt(data.get('permissionTypeId') as string);
		try {
			await db.revokePermission(params.id, instanceId, permissionTypeId);
			return { success: true };
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : 'Failed to revoke' });
		}
	}
};
