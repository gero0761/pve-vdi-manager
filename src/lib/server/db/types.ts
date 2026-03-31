export interface VDIInstance {
	id: string; // The generated ID
	vmid: number; // Proxmox ID
	type: 'qemu' | 'lxc';
	node: string;
	created_at: number;
}

export interface DatabaseAdapter {
	getInstanceById(id: string): VDIInstance | undefined;
	createInstance(instance: VDIInstance): void;
	getAllInstances(): VDIInstance[];
}
