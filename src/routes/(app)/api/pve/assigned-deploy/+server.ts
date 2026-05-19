import { json } from '@sveltejs/kit';
import { pveFetch, getNextVmid } from '$lib/server/pve';
import { db } from '$lib/server/db';
import crypto from 'crypto';
import { env } from '$env/dynamic/private';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST({ request, locals }) {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { template_vmid, template_node, template_type, template_name, deployments } = body;

		if (!template_vmid || !template_node || !template_type || !deployments || !Array.isArray(deployments)) {
			return json({ error: 'Missing required parameters' }, { status: 400 });
		}

		const clones = [];
		const permissionTypes = await db.getAllPermissionTypes();

		for (const deploy of deployments) {
			const { userId, permissionTypeId } = deploy;
			const targetUser = await db.getUserById(userId);
			if (!targetUser) continue;

			let success = false;
			let newid: number = 101;
			let generatedId = '';
			let upid = '';

			// Guarantee unique generatedId
			let idExists = true;
			while (idExists) {
				generatedId = crypto.randomBytes(4).toString('hex');
				const existing = await db.getInstanceById(generatedId);
				if (!existing) {
					idExists = false;
				}
			}

			// Clean username to be safe for Proxmox naming
			const sanitizedUsername = targetUser.username.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
			const usernameSuffix = sanitizedUsername ? `-${sanitizedUsername}` : '';
			const baseName = template_name ? template_name : 'vdi';
			const targetName = `${baseName}${usernameSuffix}-${generatedId}`.substring(0, 60);

			// Retry loop for disk lock problem
			for (let attempt = 0; attempt < 5; attempt++) {
				newid = await getNextVmid();

				const searchParams = new URLSearchParams({
					newid: newid.toString(),
					full: '0'
				});

				if (template_type === 'qemu') {
					searchParams.append('name', targetName);
				} else if (template_type === 'lxc') {
					searchParams.append('hostname', targetName);
				}

				if (env.PVE_POOL) {
					searchParams.append('pool', env.PVE_POOL);
				}

				const res = await pveFetch(
					`/nodes/${template_node}/${template_type}/${template_vmid}/clone?${searchParams.toString()}`,
					{ method: 'POST' }
				);

				const pveRes = await res.json();

				if (res.ok) {
					upid = pveRes.data;
					success = true;
					break; // Success, exit retry loop
				} else if (pveRes.message?.includes('locked')) {
					console.warn(`Template locked, retrying attempt ${attempt + 1}...`);
					await sleep(2000);
				} else {
					throw new Error(pveRes.message || 'Unknown PVE Error');
				}
			}

			if (!success) throw new Error(`Failed to clone VM for ${targetUser.username} after several attempts due to disk lock.`);

			// Wait for the clone task to COMPLETE sequentially
			let taskExitStatus = '';
			let isDone = false;
			let pollCount = 0;
			const maxPolls = 60; // Max 90 seconds wait per clone task

			while (!isDone && pollCount < maxPolls) {
				pollCount++;
				await sleep(1500);
				try {
					const taskRes = await pveFetch(`/nodes/${template_node}/tasks/${upid}/status`);
					if (!taskRes.ok) continue;
					const taskData = await taskRes.json();
					if (taskData.data?.status === 'stopped') {
						isDone = true;
						taskExitStatus = taskData.data.exitstatus;
					}
				} catch (e) {
					console.error('Task polling error:', e);
				}
			}

			if (!isDone) {
				throw new Error(`Timed out waiting for Proxmox clone task to complete.`);
			}

			if (taskExitStatus !== 'OK') {
				throw new Error(`PVE Clone task failed for VM ${newid}: ${taskExitStatus}`);
			}

			const instance = {
				id: generatedId,
				vmid: newid,
				type: template_type as 'qemu' | 'lxc',
				node: template_node,
				created_at: new Date()
			};

			await db.createInstance(instance);
			clones.push(instance);

			// Setup access permission groups
			const allGroups = await db.getAllGroups();
			const permType = permissionTypes.find((pt) => pt.id === permissionTypeId);

			if (permType) {
				if (permType.name === 'all') {
					// Use default Access group
					const accessGroupName = `Access: ${newid}`;
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
					const customGroupName = `${permType.name.charAt(0).toUpperCase() + permType.name.slice(1)}: ${newid}`;
					let customGroup = allGroups.find((g) => g.name === customGroupName);
					if (!customGroup) {
						const groupId = crypto.randomUUID();
						await db.addGroup({
							id: groupId,
							name: customGroupName,
							description: `Automated ${permType.name} access for VM ${newid}`,
							type_id: 2 // Base Permission
						});
						customGroup = { id: groupId, name: customGroupName, description: '', type_id: 2 };
					}
					await db.grantPermission(customGroup.id, instance.id, permType.id);
					await db.addMemberToGroup(customGroup.id, targetUser.id, 'user');
				}
			}

			// Background auto-start
			(async () => {
				try {
					await pveFetch(`/nodes/${template_node}/${template_type}/${newid}/status/start`, {
						method: 'POST'
					});
				} catch (e) {
					console.error('Auto-start error:', e);
				}
			})();
		}

		return json({ clones });
	} catch (err) {
		console.error('Assigned deploy error:', err);
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
	}
}
