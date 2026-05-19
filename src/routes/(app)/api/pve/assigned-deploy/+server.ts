import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import crypto from 'crypto';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST({ request, locals, fetch }) {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { template_vmid, template_node, template_type, template_name, deployments } = body;

		if (!template_vmid || !template_node || !template_type || !deployments || !Array.isArray(deployments)) {
			return json({ error: 'Missing required parameters' }, { status: 400 });
		}

		const count = deployments.length;
		if (count === 0) {
			return json({ clones: [] });
		}

		// Execute bulk clone by calling standard clone endpoint
		const cloneRes = await fetch('/api/pve/clone', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				template_vmid,
				template_node,
				template_type,
				template_name,
				count
			})
		});

		const cloneData = await cloneRes.json();
		if (!cloneRes.ok || cloneData.error) {
			return json({ error: cloneData.error || 'Failed to clone VMs' }, { status: cloneRes.status });
		}

		const clones = cloneData.clones;
		if (!clones || clones.length < count) {
			return json({ error: 'Returned clones count mismatch' }, { status: 500 });
		}

		const permissionTypes = await db.getAllPermissionTypes();

		for (let i = 0; i < deployments.length; i++) {
			const { userId, permissionTypeId } = deployments[i];
			const targetUser = await db.getUserById(userId);
			if (!targetUser) continue;

			const instance = clones[i];

			// Setup access permission groups
			const allGroups = await db.getAllGroups();
			const permType = permissionTypes.find((pt) => pt.id === permissionTypeId);

			if (permType) {
				if (permType.name === 'all') {
					// Use default Access group
					const accessGroupName = `Access: ${instance.vmid}`;
					let accessGroup = allGroups.find((g) => g.name === accessGroupName);
					if (!accessGroup) {
						// Fallback if not found for some reason, but createInstance should create it.
						await sleep(500);
						const freshGroups = await db.getAllGroups();
						accessGroup = freshGroups.find((g) => g.name === accessGroupName);
					}
					if (accessGroup) {
						await db.addMemberToGroup(accessGroup.id, targetUser.id, 'user');
					}
				} else {
					// Custom permission (e.g. console)
					const customGroupName = `${permType.name.charAt(0).toUpperCase() + permType.name.slice(1)}: ${instance.vmid}`;
					let customGroup = allGroups.find((g) => g.name === customGroupName);
					if (!customGroup) {
						const groupId = crypto.randomUUID();
						await db.addGroup({
							id: groupId,
							name: customGroupName,
							description: `Automated ${permType.name} access for VM ${instance.vmid}`,
							type_id: 2 // Base Permission
						});
						customGroup = { id: groupId, name: customGroupName, description: '', type_id: 2 };
					}
					await db.grantPermission(customGroup.id, instance.id, permType.id);
					await db.addMemberToGroup(customGroup.id, targetUser.id, 'user');
				}
			}
		}

		return json({ clones });
	} catch (err) {
		console.error('Assigned deploy error:', err);
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
	}
}
