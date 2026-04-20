import { json } from '@sveltejs/kit';
import { pveFetch } from '$lib/server/pve';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';

export async function GET() {
	try {
		const managedInstances = await db.getAllInstances();
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
