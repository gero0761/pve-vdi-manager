export interface VDIInstance {
	id: string; // The generated ID
	vmid: number; // Proxmox ID
	type: 'qemu' | 'lxc';
	node: string;
	created_at: Date;
	sync_status?: string;
}

export interface User {
	id: string;
	username: string;
	password_hash: string;
	first_name: string;
	last_name: string;
	role?: 'admin' | 'user';
}

export interface Session {
	id: string;
	user_id: string;
	created_at: Date;
	expires_at: Date;
}

export interface UserInstanceAccess {
	user_id: string;
	instance_id: string;
}

export interface DatabaseAdapter {
	getInstanceById(id: string): Promise<VDIInstance | undefined>;
	createInstance(instance: VDIInstance): Promise<void>;
	deleteInstance(id: string): Promise<void>;
	getAllInstances(): Promise<VDIInstance[]>;
	updateInstanceSyncStatus(id: string, status: string): Promise<void>;
	
	// User Management
	getUserByUsername(username: string): Promise<User | undefined>;
	getUserById(id: string): Promise<User | undefined>;
	createUser(user: User): Promise<void>;
	getAllUsers(): Promise<User[]>;
	deleteUser(id: string): Promise<void>;
	updateUser(id: string, user: Partial<User>): Promise<void>;
	
	// Session Management
	createSession(session: Session): Promise<void>;
	getSessionById(id: string): Promise<Session | undefined>;
	deleteSession(id: string): Promise<void>;

	// Access Management
	assignInstanceToUser(userId: string, instanceId: string): Promise<void>;
	removeInstanceFromUser(userId: string, instanceId: string): Promise<void>;
	getUserInstances(userId: string): Promise<VDIInstance[]>;
	hasInstanceAccess(userId: string, instanceId: string): Promise<boolean>;
}
