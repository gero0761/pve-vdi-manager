import { db } from '$lib/server/db';
import { pveFetch } from '$lib/server/pve';
import type { VDIInstance } from '$lib/server/db/types';

/**
 * Queries Proxmox cluster resources to find the current node of a VMID.
 * If the node has changed compared to the database, updates the database.
 * Returns the correct node name.
 */
export async function resolveCurrentNode(instance: VDIInstance): Promise<string> {
	try {
		console.log(`[HA-NodeResolver] Resolving current node for VMID ${instance.vmid}...`);
		const res = await pveFetch('/cluster/resources');
		const data = await res.json();
		const resources = data.data || [];

		const found = resources.find(
			(r: { type: string; vmid: number; node?: string }) =>
				(r.type === 'qemu' || r.type === 'lxc') && r.vmid === instance.vmid
		);

		if (found && found.node && found.node !== instance.node) {
			console.log(
				`[HA-NodeResolver] Instance ${instance.id} (VMID: ${instance.vmid}) has migrated from node '${instance.node}' to '${found.node}'. Updating database.`
			);
			await db.updateInstanceNode(instance.id, found.node);
			instance.node = found.node; // Update the reference in memory
		}
	} catch (err) {
		console.error(`[HA-NodeResolver] Failed to resolve current node for VMID ${instance.vmid}:`, err);
	}
	return instance.node;
}

/**
 * Runs a function that executes a Proxmox API call. If the call fails, checks if the VM
 * has migrated to another node, updates the database, and retries the function once.
 */
export async function executeWithHaRetry<T>(
	instance: VDIInstance,
	operation: (node: string) => Promise<T>
): Promise<T> {
	try {
		return await operation(instance.node);
	} catch (error: any) {
		console.warn(
			`[HA-Retry] Operation failed on node ${instance.node} for VMID ${instance.vmid}. Checking if migrated...`
		);
		const originalNode = instance.node;
		const currentNode = await resolveCurrentNode(instance);

		if (currentNode !== originalNode) {
			console.log(`[HA-Retry] Instance migrated to ${currentNode}. Retrying operation.`);
			return await operation(currentNode);
		}

		throw error; // Re-throw if it wasn't a migration issue (or if resolveCurrentNode returned the same node)
	}
}
