import { json } from '@sveltejs/kit';
import { pveFetch, getNextVmid } from '$lib/server/pve';
import { db } from '$lib/server/db';
import crypto from 'crypto';

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { template_vmid, template_node, template_type, count } = body;

		if (!template_vmid || !template_node || !template_type || !count) {
			return json({ error: 'Missing required parameters' }, { status: 400 });
		}

		const clones = [];

		for (let i = 0; i < count; i++) {
			// Get next vmid
			const newid = await getNextVmid();

			// Generate friendly ID for URL
			const generatedId = crypto.randomBytes(4).toString('hex');

			// Issue clone command to Proxmox
			// Required parameter for cloning is 'newid'
			const searchParams = new URLSearchParams({ newid: newid.toString() });

			const res = await pveFetch(
				`/nodes/${template_node}/${template_type}/${template_vmid}/clone?${searchParams.toString()}`,
				{
					method: 'POST'
				}
			);

			const pveRes = await res.json();
			const upid = pveRes.data;

			// Background polling to start the instance when clone finishes
			(async () => {
				let isDone = false;
				while (!isDone) {
					await new Promise(r => setTimeout(r, 2000));
					try {
						const taskRes = await pveFetch(`/nodes/${template_node}/tasks/${upid}/status`);
						const taskData = await taskRes.json();
						if (taskData.data.status === 'stopped') {
							isDone = true;
							if (taskData.data.exitstatus === 'OK') {
								// Start the instance
								await pveFetch(`/nodes/${template_node}/${template_type}/${newid}/status/start`, { method: 'POST' });
							}
						}
					} catch(e) {
						console.error('Auto-start polling error:', e);
					}
				}
			})();

			// Even if Proxmox is still cloning, it returns an UPID task identifier.
			// We assume successful initiation means we can bind our ID.

			const instance = {
				id: generatedId,
				vmid: newid,
				type: template_type as 'qemu' | 'lxc',
				node: template_node,
				created_at: Date.now()
			};

			db.createInstance(instance);
			clones.push(instance);
		}

		return json({ clones });
	} catch (err) {
		console.error('Clone error:', err);
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
	}
}
