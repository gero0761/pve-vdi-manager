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

export interface UserGroup {
	id: string;
	name: string;
	description: string;
	protected?: number;
}

export interface GroupMember {
	group_id: string;
	member_id: string;
	member_type: 'user' | 'group';
}

export interface PermissionType {
	id: number;
	name: string;
	description: string;
}

export interface InstancePermission {
	group_id: string;
	instance_id: string;
	permission_type_id: number;
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

	// Group Management
	addGroup(group: UserGroup): Promise<void>;
	deleteGroup(id: string): Promise<void>;
	updateGroup(id: string, group: Partial<UserGroup>): Promise<void>;
	getAllGroups(): Promise<UserGroup[]>;
	getGroupById(id: string): Promise<UserGroup | undefined>;

	// Membership Management
	addMemberToGroup(groupId: string, memberId: string, memberType: 'user' | 'group'): Promise<void>;
	removeMemberFromGroup(groupId: string, memberId: string): Promise<void>;
	getGroupMembers(groupId: string): Promise<GroupMember[]>;
	getUserGroups(userId: string): Promise<UserGroup[]>;
    getGroupsWhereMember(memberId: string, memberType: 'user' | 'group'): Promise<UserGroup[]>;

	// Permission Management
	getAllPermissionTypes(): Promise<PermissionType[]>;
	getPermissionTypeByName(name: string): Promise<PermissionType | undefined>;
	grantPermission(groupId: string, instanceId: string, permissionTypeId: number): Promise<void>;
	revokePermission(groupId: string, instanceId: string, permissionTypeId: number): Promise<void>;
	getInstancePermissions(instanceId: string): Promise<InstancePermission[]>;
	getPermissionsByGroup(groupId: string): Promise<InstancePermission[]>;
	
	// Access Management
	getUserGroupIds(userId: string): Promise<string[]>;
	getUserInstances(userId: string): Promise<VDIInstance[]>;
	hasInstanceAccess(userId: string, instanceId: string, permissionName?: string): Promise<boolean>;
}
