import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Forbidden');

	const user = await db.getUserById(params.id);
	if (!user) throw error(404, 'User not found');

	// Get ALL groups (direct + indirect)
	const allUserGroups = await db.getUserGroups(user.id);
	
    const directGroupIds = new Set<string>();
    const allGroups = await db.getAllGroups();

    for (const group of allUserGroups) {
        const members = await db.getGroupMembers(group.id);
        if (members.some(m => m.member_id === user.id && m.member_type === 'user')) {
            directGroupIds.add(group.id);
        }
    }

	const userGroups = allUserGroups.map(g => ({
        ...g,
        isDirect: directGroupIds.has(g.id)
    }));

	const availableGroups = allGroups.filter(
		g => !userGroups.some(ug => ug.id === g.id && ug.isDirect)
	);

	// Get instances and their sources
	const accessibleInstances = await db.getUserInstances(user.id);
    const instanceWithSources = [];

    const permissionTypes = await db.getAllPermissionTypes();

    for (const inst of accessibleInstances) {
        const perms = await db.getInstancePermissions(inst.id);
        const sources = [];
        for (const p of perms) {
            const group = allUserGroups.find(ug => ug.id === p.group_id);
            if (group) {
                sources.push({
                    groupName: group.name,
                    groupId: group.id,
                    permissionName: permissionTypes.find(pt => pt.id === p.permission_type_id)?.name
                });
            }
        }
        instanceWithSources.push({
            ...inst,
            sources
        });
    }

	return {
		targetUser: user,
		userGroups,
		availableGroups,
		instanceWithSources
	};
};

export const actions: Actions = {
	addGroup: async ({ request, params, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);
		const data = await request.formData();
		const groupId = data.get('groupId')?.toString();
		if (!groupId) return fail(400, { error: 'Group ID is required' });
		try {
            await db.addMemberToGroup(groupId, params.id, 'user');
            return { success: true };
        } catch (err) {
            return fail(400, { error: err instanceof Error ? err.message : 'Failed to add to group' });
        }
	},
	removeGroup: async ({ request, params, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);
		const data = await request.formData();
		const groupId = data.get('groupId')?.toString();
		if (!groupId) return fail(400, { error: 'Group ID is required' });
		await db.removeMemberFromGroup(groupId, params.id);
		return { success: true };
	}
};
