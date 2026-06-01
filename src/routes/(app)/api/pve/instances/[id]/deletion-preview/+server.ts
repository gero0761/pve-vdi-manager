import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: instanceId } = params;

	// 1. Get the instance to check permissions
	const instance = await db.getInstanceById(instanceId);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}

	// 2. Security Check: Only admin or users with DELETE permission on this instance
	if (user.role !== 'admin') {
		const hasDelete = await db.hasInstanceAccess(user.id, instanceId, 'delete');
		if (!hasDelete) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
	}

	// 3. Find all groups that have permissions for THIS instance
	const groupPerms = await db.getInstancePermissions(instanceId);
	const candidateGroupIds = [...new Set(groupPerms.map(p => p.group_id))];
	const candidateGroups = [];

	for (const groupId of candidateGroupIds) {
		const group = await db.getGroupDetailedById(groupId);
		if (!group || group.type.is_protected) continue;

		// Cleanup Logic (Same as in DELETE handler)
		
		// A. Check if group has permissions for OTHER instances
		const otherPerms = await db.getPermissionsByGroup(groupId);
		const hasOtherInstances = otherPerms.some((p: any) => p.instance_id !== instanceId);
		if (hasOtherInstances) continue;

		// B. Check if it's a sub-group (has parent groups)
		const parentGroups = await db.getGroupsWhereMember(groupId, 'group');
		if (parentGroups.length > 0) continue;

		// Suggest ALL groups that only have permissions for this VM and no parents
		candidateGroups.push({
			id: group.id,
			name: group.name,
			description: group.description
		});
	}

	return json({ groups: candidateGroups });
};
