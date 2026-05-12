import { db } from '$lib/server/db';
import { fail } from '@sveltejs/kit';
import crypto from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return { groups: [], groupTypes: [], instances: [], permissionTypes: [] };
	}

	const [groups, groupTypes, instances, permissionTypes] = await Promise.all([
		db.getAllGroupsDetailed(),
		db.getAllGroupTypes(),
		db.getAllInstances(),
		db.getAllPermissionTypes()
	]);
	
	return { 
		groups,
		groupTypes,
		instances,
		permissionTypes
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);
		
		const data = await request.formData();
		const name = data.get('name') as string;
		const description = data.get('description') as string;
		const typeIdStr = data.get('type_id') as string;
		const typeId = typeIdStr ? parseInt(typeIdStr) : 2; // Default to Standard if not provided

		if (!name) return fail(400, { error: 'Name is required' });

		try {
			await db.addGroup({
				id: crypto.randomUUID(),
				name,
				description: description || '',
				type_id: typeId
			});
			return { success: true };
		} catch (err: any) {
			if (err.message?.includes('UNIQUE') || err.message?.includes('Duplicate entry')) {
				return fail(400, { error: 'A group with this name already exists.' });
			}
			return fail(400, { error: 'Failed to create group' });
		}
	},
	quickCreate: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);
		
		const data = await request.formData();
		const instanceIds = data.getAll('instanceIds') as string[];
		const permissionType = data.get('permissionType') as string;

		if (!instanceIds || instanceIds.length === 0) return fail(400, { error: 'No instances selected' });
		if (!permissionType) return fail(400, { error: 'Permission type is required' });

		const typeInfo = await db.getPermissionTypeByName(permissionType);
		if (!typeInfo) return fail(400, { error: 'Invalid permission type' });

		try {
			const [allGroups, allInstances] = await Promise.all([
				db.getAllGroups(),
				db.getAllInstances()
			]);
			
			for (const id of instanceIds) {
				const inst = allInstances.find(i => i.id === id);
				if (!inst) continue;

				const groupName = `${permissionType.charAt(0).toUpperCase() + permissionType.slice(1)}: ${inst.vmid}`;
				
				// Check if group already exists
				let groupId: string;
				const existingGroup = allGroups.find(g => g.name === groupName);
				
				if (existingGroup) {
					groupId = existingGroup.id;
				} else {
					groupId = crypto.randomUUID();
					await db.addGroup({
						id: groupId,
						name: groupName,
						description: `Automated ${permissionType} access for VM ${inst.vmid}`,
						type_id: 2 // Permission
					});
					// Add newly created group to our local list to avoid duplicate creation in same batch
					allGroups.push({ id: groupId, name: groupName, description: '', type_id: 2 });
				}

				await db.grantPermission(groupId, id, typeInfo.id);
			}
			return { success: true };
		} catch (err: any) {
			console.error('QuickCreate error:', err);
			return fail(400, { error: 'Failed to batch create or update groups.' });
		}
	},
	bulkDelete: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);

		const data = await request.formData();
		const ids = data.getAll('ids') as string[];

		if (!ids || ids.length === 0) return fail(400, { error: 'No groups selected' });

		try {
			for (const id of ids) {
				const group = await db.getGroupById(id);
				// type_id 1 is System/Protected
				if (group && group.type_id !== 1) {
					await db.deleteGroup(id);
				}
			}
			return { success: true };
		} catch (err) {
			console.error('BulkDelete error:', err);
			return fail(400, { error: 'Failed to delete some groups.' });
		}
	},
	delete: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') return fail(403);

		const data = await request.formData();
		const id = data.get('id') as string;

		try {
			await db.deleteGroup(id);
			return { success: true };
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : 'Failed to delete group' });
		}
	}
};
