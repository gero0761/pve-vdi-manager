import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { pveFetch } from '$lib/server/pve';

// GET /api/pve/instances/[id] -> Get current status from Proxmox
export async function GET({ params }) {
	const { id } = params;
	const instance = db.getInstanceById(id);

	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}

	try {
		const res = await pveFetch(`/nodes/${instance.node}/${instance.type}/${instance.vmid}/status/current`);
		const data = await res.json();
		return json({ status: data.data.status }); // 'running', 'stopped', etc.
	} catch (err) {
		console.error('Fetch status error:', err);
		return json({ error: 'Failed to fetch status from Proxmox' }, { status: 500 });
	}
}

// POST /api/pve/instances/[id] -> Action (stop, start, etc.)
export async function POST({ params, request }) {
	const { id } = params;
	const { action } = await request.json();
	const instance = db.getInstanceById(id);

	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
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
export async function DELETE({ params }) {
	const { id } = params;
	const instance = db.getInstanceById(id);

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
		db.deleteInstance(id);

		return json({ success: true });
	} catch (err) {
		console.error('Delete instance error:', err);
		return json({ error: 'Failed to delete instance from Proxmox' }, { status: 500 });
	}
}
