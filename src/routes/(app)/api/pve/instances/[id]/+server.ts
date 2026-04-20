import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { pveFetch } from '$lib/server/pve';

// GET /api/pve/instances/[id] -> Get current status and IP from Proxmox
export async function GET({ params, locals }) {
	const { id } = params;
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const instance = await db.getInstanceById(id);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}

	// Access Check
	if (user.role !== 'admin') {
		const hasAccess = await db.hasInstanceAccess(user.id, instance.id);
		if (!hasAccess) return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const statusRes = await pveFetch(
			`/nodes/${instance.node}/${instance.type}/${instance.vmid}/status/current`
		);
		const statusData = await statusRes.json();
		const status = statusData.data.status;

		let ip = null;

		if (status === 'running') {
			try {
				if (instance.type === 'lxc') {
					const netRes = await pveFetch(`/nodes/${instance.node}/lxc/${instance.vmid}/interfaces`);
					const netData = await netRes.json();
					// Find first non-loopback IPv4
					const iface = netData.data.find(
						(i: any) => i.inet && !i.inet.startsWith('127.') && !i.inet.startsWith('::')
					);
					if (iface) {
						ip = iface.inet.split('/')[0];
					}
				} else if (instance.type === 'qemu') {
					const agentRes = await pveFetch(
						`/nodes/${instance.node}/qemu/${instance.vmid}/agent/network-get-interfaces`
					);
					const agentData = await agentRes.json();
					
					// Proxmox agent calls usually return data in .data.result
					const interfaces = agentData.data?.result || agentData.data;
					
					if (interfaces && Array.isArray(interfaces)) {
						for (const iface of interfaces) {
							if (iface.name === 'lo') continue;
							const addr = iface['ip-addresses']?.find((a: any) => a['ip-address-type'] === 'ipv4');
							if (addr && !addr['ip-address'].startsWith('127.')) {
								ip = addr['ip-address'];
								break;
							}
						}
					}
				}
			} catch (e) {
				// Guest agent might not be running or supported
				//console.warn(`Could not fetch IP for ${instance.id}:`, e);
			}
		}

		return json({ status, ip });
	} catch (err) {
		console.error('Fetch status error:', err);
		return json({ error: 'Failed to fetch status from Proxmox' }, { status: 500 });
	}
}

// POST /api/pve/instances/[id] -> Action (stop, start, etc.)
export async function POST({ params, request, locals }) {
	const { id } = params;
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { action } = await request.json();
	const instance = await db.getInstanceById(id);

	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}

	// Access Check
	if (user.role !== 'admin') {
		const hasAccess = await db.hasInstanceAccess(user.id, instance.id);
		if (!hasAccess) return json({ error: 'Forbidden' }, { status: 403 });
	}

	if (!['stop', 'start', 'shutdown'].includes(action)) {
		return json({ error: 'Invalid action' }, { status: 400 });
	}

	try {
		await pveFetch(`/nodes/${instance.node}/${instance.type}/${instance.vmid}/status/${action}`, {
			method: 'POST'
		});
		return json({ success: true });
	} catch (err) {
		console.error(`Action ${action} error:`, err);
		return json({ error: `Failed to ${action} instance` }, { status: 500 });
	}
}

// DELETE /api/pve/instances/[id] -> Delete from Proxmox and DB
export async function DELETE({ params, locals }) {
	const { id } = params;
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	
	// Delete is ADMIN ONLY
	if (user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const instance = await db.getInstanceById(id);

	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}

	try {
		// 1. Stop if running (Proxmox requires stopped for deletion)
		try {
			await pveFetch(`/nodes/${instance.node}/${instance.type}/${instance.vmid}/status/stop`, {
				method: 'POST'
			});
			// Wait a bit for it to stop
			await new Promise((r) => setTimeout(r, 1000));
		} catch {
			// Ignore if already stopped
		}

		// 2. Delete from Proxmox
		await pveFetch(`/nodes/${instance.node}/${instance.type}/${instance.vmid}`, {
			method: 'DELETE'
		});

		// 3. Delete from DB
		await db.deleteInstance(id);

		return json({ success: true });
	} catch (err) {
		console.error('Delete instance error:', err);
		return json({ error: 'Failed to delete instance from Proxmox' }, { status: 500 });
	}
}
