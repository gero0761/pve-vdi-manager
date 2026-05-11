import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { instanceIds } = await request.json();
	if (!Array.isArray(instanceIds) || instanceIds.length === 0) {
		return json({ groups: [] });
	}

	// For security, if not admin, check if user has delete permission on ALL instances
	if (user.role !== 'admin') {
		for (const id of instanceIds) {
			const hasDelete = await db.hasInstanceAccess(user.id, id, 'delete');
			if (!hasDelete) {
				return json({ error: `Forbidden: No delete permission for instance ${id}` }, { status: 403 });
			}
		}
	}

	const allCandidateGroups = new Map<string, { id: string, name: string, description: string }>();

	for (const instanceId of instanceIds) {
		const groupPerms = await db.getInstancePermissions(instanceId);
		const candidateGroupIds = [...new Set(groupPerms.map(p => p.group_id))];

		for (const groupId of candidateGroupIds) {
			if (allCandidateGroups.has(groupId)) continue;

			const group = await db.getGroupById(groupId);
			if (!group || group.protected === 1) continue;

			// Check if group has permissions for instances OUTSIDE of the deletion list
			const allPerms = await db.getPermissionsByGroup(groupId);
			const hasExternalInstances = allPerms.some((p: any) => !instanceIds.includes(p.instance_id));
			if (hasExternalInstances) continue;

			// Check if it's a sub-group (has parent groups)
			const parentGroups = await db.getGroupsWhereMember(groupId, 'group');
			if (parentGroups.length > 0) continue;

			// Heuristic removed: Show ALL groups that would become orphaned
			allCandidateGroups.set(groupId, {
				id: group.id,
				name: group.name,
				description: group.description
			});
		}
	}

	return json({ groups: Array.from(allCandidateGroups.values()) });
};
