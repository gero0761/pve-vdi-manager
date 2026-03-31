import { json } from '@sveltejs/kit';
import { pveFetch } from '$lib/server/pve';

export interface Template {
	vmid: number;
	name: string;
	node: string;
	type: 'qemu' | 'lxc';
}

export async function GET() {
	try {
		// Fetch all nodes
		const nodesRes = await pveFetch('/nodes');
		const nodesData = await nodesRes.json();
		const nodes = nodesData.data;

		const templates: Template[] = [];

		// For each node, fetch qemu and lxc instances and filter for templates
		for (const node of nodes) {
			const nodeName = node.node;

			// Fetch VMs (qemu)
			const qemuRes = await pveFetch(`/nodes/${nodeName}/qemu`);
			const qemuData = await qemuRes.json();
			for (const vm of qemuData.data) {
				if (vm.template === 1) {
					templates.push({
						vmid: vm.vmid,
						name: vm.name,
						node: nodeName,
						type: 'qemu'
					});
				}
			}

			// Fetch LXC containers (lxc)
			const lxcRes = await pveFetch(`/nodes/${nodeName}/lxc`);
			const lxcData = await lxcRes.json();
			for (const ct of lxcData.data) {
				if (ct.template === 1) {
					templates.push({
						vmid: ct.vmid,
						name: ct.name || `CT ${ct.vmid}`,
						node: nodeName,
						type: 'lxc'
					});
				}
			}
		}

		return json({ templates });
	} catch (err: any) {
		console.error('Failed to fetch PVE templates:', err);
		return json({ error: 'Failed to fetch templates from Proxmox' }, { status: 500 });
	}
}
