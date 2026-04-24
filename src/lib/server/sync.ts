import { db } from '$lib/server/db';
import { pveFetch } from '$lib/server/pve';
import { env } from '$env/dynamic/private';

export async function runSyncJob() {
	if (!env.PVE_POOL) {
		console.warn('[Sync] PVE_POOL is not defined in environment variables. Skipping sync.');
		return;
	}

	try {
		console.log(`[Sync] Running periodic database synchronizer with PVE Pool: ${env.PVE_POOL}`);
		const poolRes = await pveFetch(`/pools/${env.PVE_POOL}`);
		const poolData = await poolRes.json();
		const pveMembers = poolData.data?.members || [];

		// Create a quick lookup map from Proxmox
		const pveMap = new Set(pveMembers.map((m: any) => `${m.type}-${m.vmid}`));

		const dbInstances = await db.getAllInstances();

		let orphanedCount = 0;
		let syncedCount = 0;

		for (const instance of dbInstances) {
			const existsInPve = pveMap.has(`${instance.type}-${instance.vmid}`);

			if (!existsInPve && instance.sync_status !== 'orphaned') {
				console.log(
					`[Sync] Instance ${instance.id} (VMID: ${instance.vmid}) not found in Proxmox Pool. Marking as orphaned.`
				);
				await db.updateInstanceSyncStatus(instance.id, 'orphaned');
				orphanedCount++;
			} else if (existsInPve && instance.sync_status === 'orphaned') {
				// E.g., someone re-added it back to the pool
				console.log(
					`[Sync] Instance ${instance.id} (VMID: ${instance.vmid}) was restored in Proxmox Pool. Marking as synced.`
				);
				await db.updateInstanceSyncStatus(instance.id, 'synced');
				syncedCount++;
			}
		}

		if (orphanedCount > 0 || syncedCount > 0) {
			console.log(
				`[Sync] Completed. Marked ${orphanedCount} as orphaned, restored ${syncedCount} as synced.`
			);
		}
	} catch (err) {
		console.error('[Sync] Error synchronizing with Proxmox:', err);
	}
}
