import { db } from '$lib/server/db';
import { json } from '@sveltejs/kit';

export async function GET({ locals }) {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const groups = await db.getAllGroupsDetailed();
		const groupsWithMembers = [];
		for (const group of groups) {
			const members = await db.getGroupMembers(group.id);
			// Filter to only 'user' type members
			const userMembers = members.filter((m) => m.member_type === 'user');

			groupsWithMembers.push({
				id: group.id,
				name: group.name,
				description: group.description,
				type_id: group.type_id,
				is_protected: group.type?.is_protected,
				users: userMembers.map((m) => m.member_id)
			});
		}
		const allUsers = await db.getAllUsers();
		const permissionTypes = await db.getAllPermissionTypes();

		return json({
			groups: groupsWithMembers,
			users: allUsers.map((u) => ({
				id: u.id,
				username: u.username,
				first_name: u.first_name,
				last_name: u.last_name
			})),
			permissionTypes
		});
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
	}
}
