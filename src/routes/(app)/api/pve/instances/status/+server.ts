import { json } from '@sveltejs/kit';
import { pveFetch } from '$lib/server/pve';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';

export async function GET({ locals }) {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		let managedInstances;
		if (user.role === 'admin') {
			managedInstances = await db.getAllInstances();
		} else {
			managedInstances = await db.getUserInstances(user.id);
		}

		if (managedInstances.length === 0) {
			return json({ statuses: {} });
		}

		// Fetch all resources in the cluster
		const res = await pveFetch('/cluster/resources');
		const data = await res.json();
		const resources = data.data || [];

		// Create a map for quick lookup
		const resourceMap = new Map();
		for (const r of resources) {
			if (r.type === 'qemu' || r.type === 'lxc') {
				// Filter by pool if configured
				if (env.PVE_POOL && r.pool !== env.PVE_POOL) continue;
				
				resourceMap.set(`${r.node}:${r.type}:${r.vmid}`, {
					status: r.status,
					uptime: r.uptime,
					cpu: r.cpu,
					mem: r.mem,
					maxmem: r.maxmem,
					netin: r.netin,
					netout: r.netout
				});
			}
		}

		const statuses: Record<string, any> = {};
		for (const inst of managedInstances) {
			const key = `${inst.node}:${inst.type}:${inst.vmid}`;
			const pveStatus = resourceMap.get(key);
			
			if (pveStatus) {
				statuses[inst.id] = pveStatus;
			} else {
				statuses[inst.id] = { status: 'unknown' };
			}
		}

		return json({ statuses });
	} catch (err) {
		console.error('Bulk status fetch error:', err);
		return json({ error: 'Failed to fetch bulk status' }, { status: 500 });
	}
}
