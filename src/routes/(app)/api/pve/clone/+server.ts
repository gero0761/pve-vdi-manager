import { json } from '@sveltejs/kit';
import { pveFetch, getNextVmid } from '$lib/server/pve';
import { db } from '$lib/server/db';
import crypto from 'crypto';
import { env } from '$env/dynamic/private';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { template_vmid, template_node, template_type, count, template_name } = body;

		if (!template_vmid || !template_node || !template_type || !count) {
			return json({ error: 'Missing required parameters' }, { status: 400 });
		}

		const clones = [];

		// Loop for Creating Clones:
		for (let i = 0; i < count; i++) {
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

			// Define the proxmox display name or hostname
			const targetName = template_name ? `${template_name}-${generatedId}` : generatedId;

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
					//console.log('Adding pool to clone parameters:', env.PVE_POOL);
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
					// Sleep 2 seconds before next attempt (when full is set to 1 5000 is probably needed)
					await sleep(2000);
				} else {
					throw new Error(pveRes.message || 'Unknown PVE Error');
				}
			}

			if (!success) throw new Error(`Failed to clone after several attempts due to disk lock.`);

			// Wait for the clone task to COMPLETE sequentially before moving to the next iteration
			// This prevents Proxmox storage lock timeouts when cloning multiple instances
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

			// Background auto-start (we do not need to block the next clone operation for it to boot)
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
		console.error('Clone error:', err);
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
	}
}
