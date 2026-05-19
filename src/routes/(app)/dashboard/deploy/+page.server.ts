import { db } from '$lib/server/db';
import { pveFetch } from '$lib/server/pve';
import { redirect } from '@sveltejs/kit';

export interface Template {
	vmid: number;
	name: string;
	node: string;
	type: 'qemu' | 'lxc';
}

export interface Group {
	id: string;
	name: string;
	description: string | null;
	type_id: number;
	is_protected: boolean;
	users: string[];
}

export interface User {
	id: string;
	username: string;
	first_name: string | null;
	last_name: string | null;
}

export interface PermissionType {
	id: number;
	name: string;
	description: string | null;
}

export async function load({ locals }) {
	if (!locals.user || locals.user.role !== 'admin') {
		throw redirect(302, '/dashboard');
	}

	const templates: Template[] = [];
	let templateError = '';

	try {
		// Fetch all nodes from Proxmox
		const nodesRes = await pveFetch('/nodes');
		if (!nodesRes.ok) {
			throw new Error(`Nodes request failed with status ${nodesRes.status}`);
		}
		const nodesData = await nodesRes.json();
		const nodes = nodesData.data || [];

		// For each node, fetch qemu and lxc instances and filter for templates
		for (const node of nodes) {
			const nodeName = node.node;

			// Fetch VMs (qemu)
			try {
				const qemuRes = await pveFetch(`/nodes/${nodeName}/qemu`);
				if (qemuRes.ok) {
					const qemuData = await qemuRes.json();
					for (const vm of qemuData.data || []) {
						if (vm.template === 1) {
							templates.push({
								vmid: vm.vmid,
								name: vm.name,
								node: nodeName,
								type: 'qemu'
							});
						}
					}
				}
			} catch (e) {
				console.error(`Failed to fetch QEMU templates for node ${nodeName}:`, e);
			}

			// Fetch LXC containers (lxc)
			try {
				const lxcRes = await pveFetch(`/nodes/${nodeName}/lxc`);
				if (lxcRes.ok) {
					const lxcData = await lxcRes.json();
					for (const ct of lxcData.data || []) {
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
			} catch (e) {
				console.error(`Failed to fetch LXC templates for node ${nodeName}:`, e);
			}
		}
	} catch (err: unknown) {
		const errMsg = err instanceof Error ? err.message : String(err);
		console.error('Failed to fetch PVE templates:', errMsg);
		templateError = 'Failed to fetch templates from Proxmox';
	}

	const groups: Group[] = [];
	let allUsers: User[] = [];
	let permissionTypes: PermissionType[] = [];

	try {
		const dbGroups = await db.getAllGroupsDetailed();
		for (const group of dbGroups) {
			const members = await db.getGroupMembers(group.id);
			const userMembers = members.filter((m) => m.member_type === 'user');

			groups.push({
				id: group.id,
				name: group.name,
				description: group.description,
				type_id: group.type_id,
				is_protected: !!group.type?.is_protected,
				users: userMembers.map((m) => m.member_id)
			});
		}
		const dbUsers = await db.getAllUsers();
		allUsers = dbUsers.map((u) => ({
			id: u.id,
			username: u.username,
			first_name: u.first_name,
			last_name: u.last_name
		}));
		permissionTypes = await db.getAllPermissionTypes();
	} catch (err) {
		console.error('Database query failed for deployment prefetch:', err);
	}

	return {
		templates,
		templateError,
		groups,
		users: allUsers,
		permissionTypes
	};
}
