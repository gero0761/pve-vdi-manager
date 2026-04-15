export interface VDIInstance {
	id: string; // The generated ID
	vmid: number; // Proxmox ID
	type: 'qemu' | 'lxc';
	node: string;
	created_at: number;
}

export interface User {
	id: string;
	username: string;
	password_hash: string;
	first_name: string;
	last_name: string;
}

export interface Session {
	id: string;
	user_id: string;
	created_at: number;
	expires_at: number;
}

export interface DatabaseAdapter {
	getInstanceById(id: string): Promise<VDIInstance | undefined>;
	createInstance(instance: VDIInstance): Promise<void>;
	deleteInstance(id: string): Promise<void>;
	getAllInstances(): Promise<VDIInstance[]>;
	
	// User Management
	getUserByUsername(username: string): Promise<User | undefined>;
	getUserById(id: string): Promise<User | undefined>;
	createUser(user: User): Promise<void>;
	
	// Session Management
	createSession(session: Session): Promise<void>;
	getSessionById(id: string): Promise<Session | undefined>;
	deleteSession(id: string): Promise<void>;
}
