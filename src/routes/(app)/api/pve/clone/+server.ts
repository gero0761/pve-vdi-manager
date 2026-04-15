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

			// Background polling: Starts the instance after cloning is done
			(async () => {
				let isDone = false;
				while (!isDone) {
					await sleep(3000);
					try {
						const taskRes = await pveFetch(`/nodes/${template_node}/tasks/${upid}/status`);
						const taskData = await taskRes.json();
						if (taskData.data.status === 'stopped') {
							isDone = true;
							if (taskData.data.exitstatus === 'OK') {
								await pveFetch(`/nodes/${template_node}/${template_type}/${newid}/status/start`, {
									method: 'POST'
								});
							}
						}
					} catch (e) {
						console.error('Auto-start polling error:', e);
					}
				}
			})();

			const instance = {
				id: generatedId,
				vmid: newid,
				type: template_type as 'qemu' | 'lxc',
				node: template_node,
				created_at: Date.now()
			};

			await db.createInstance(instance);
			clones.push(instance);

			// Small buffer between iterations to give the API some time
			await sleep(500);
		}

		return json({ clones });
	} catch (err) {
		console.error('Clone error:', err);
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
	}
}
