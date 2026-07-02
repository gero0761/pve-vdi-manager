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
	type_id: number;
	description: string;
}

export interface GroupType {
	id: number;
	name: string;
	description: string;
	is_protected: boolean;
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
	/*
	* Returns a VDI instance by its alpha-id
	* @param {string} id - The alpha-id of the VDI instance
	* @type {VDIInstance} Interface of a VDI instance
	*/
	getInstanceById(id: string): Promise<VDIInstance | undefined>;
	/*
	* Creates a new VDI instance
	* @param {VDIInstance} instance - The VDI instance to create
	* @type {VDIInstance} Interface of a VDI instance
	*/
	createInstance(instance: VDIInstance): Promise<void>;
	/*
	* Deletes a VDI instance by its alpha-id
	* @param {string} id - The alpha-id of the VDI instance
	*/
	deleteInstance(id: string): Promise<void>;
	/*
	* Returns all VDI instances
	* @type {VDIInstance[]} Array of VDI instances
	*/
	getAllInstances(): Promise<VDIInstance[]>;
	/*
	* Updates the sync status of a VDI instance
	* @param {string} id - The alpha-id of the VDI instance
	* @param {string} status - The sync status of the VDI instance (synced | orphaned)
	*/
	updateInstanceSyncStatus(id: string, status: string): Promise<void>;
	/*
	* Updates the node of a VDI instance
	* @param {string} id - The alpha-id of the VDI instance
	* @param {string} node - The new Proxmox node name
	*/
	updateInstanceNode(id: string, node: string): Promise<void>;
	
	// User Management
	/*
	* Gets a user by username
	* @param {string} username - The username of the user
	* @type {User} Interface of a user
	*/
	getUserByUsername(username: string): Promise<User | undefined>;
	/*
	* Gets a user by ID
	* @param {string} id - The ID of the user
	* @type {User} Interface of a user
	*/
	getUserById(id: string): Promise<User | undefined>;
	/*
	* Creates a new user
	* @param {User} user - The user to create
	* @type {User} Interface of a user
	*/
	createUser(user: User): Promise<void>;
	/*
	* Returns all users
	* @type {User[]} Array of users
	*/
	getAllUsers(): Promise<User[]>;
	/*
	* Deletes a user by ID
	* @param {string} id - The ID of the user
	*/
	deleteUser(id: string): Promise<void>;
	/*
	* Updates a user by ID
	* @param {string} id - The ID of the user
	* @param {Partial<User>} user - The user to update
	*/
	updateUser(id: string, user: Partial<User>): Promise<void>;
	
	// Session Management
	createSession(session: Session): Promise<void>;
	getSessionById(id: string): Promise<Session | undefined>;
	deleteSession(id: string): Promise<void>;

	// Group Management
	/*
	* Adds a group
	* @param {UserGroup} group - The group to add
	* @type {UserGroup} Interface of a group
	*/
	addGroup(group: UserGroup): Promise<void>;
	/*
	* Deletes a group by ID
	* @param {string} id - The ID of the group
	*/
	deleteGroup(id: string): Promise<void>;
	/*
	* Updates a group by ID
	* @param {string} id - The ID of the group
	* @param {Partial<UserGroup>} group - The group to update
	*/
	updateGroup(id: string, group: Partial<UserGroup>): Promise<void>;
	/*
	* Returns all groups
	* @type {UserGroup[]} Array of groups
	*/
	getAllGroups(): Promise<UserGroup[]>;
	/*
	* Returns all groups with detailed information from GroupType table.
	* @type {(UserGroup & { type: GroupType })[]} Array of groups with type
	*/
	getAllGroupsDetailed(): Promise<(UserGroup & { type: GroupType })[]>;
	/*
	* Gets a group by ID
	* @param {string} id - The ID of the group
	* @type {UserGroup} Interface of a group
	*/
	getGroupById(id: string): Promise<UserGroup | undefined>;
	/*
	* Gets a group by ID with detailed information from GroupType table.
	* @param {string} id - The ID of the group
	* @type {UserGroup & { type: GroupType }} Interface of a group with type
	*/
	getGroupDetailedById(id: string): Promise<UserGroup & { type: GroupType } | undefined>;
	/*
	* Returns all group types
	* @type {GroupType[]} Array of group types
	*/
	getAllGroupTypes(): Promise<GroupType[]>;
	/*
	* Gets a group type by ID
	* @param {string} id - The ID of the group type
	* @type {GroupType} Interface of a group type
	*/
	getGroupTypeById(id: string): Promise<GroupType | undefined>;

	// Membership Management
	/*
	* Adds a member to a group
	* @param {string} groupId - The ID of the group
	* @param {string} memberId - The ID of the member
	* @param {'user' | 'group'} memberType - The type of the member
	*/
	addMemberToGroup(groupId: string, memberId: string, memberType: 'user' | 'group'): Promise<void>;
	/*
	* Removes a member from a group
	* @param {string} groupId - The ID of the group
	* @param {string} memberId - The ID of the member
	*/
	removeMemberFromGroup(groupId: string, memberId: string): Promise<void>;
	/*
	* Gets all members of a group
	* @param {string} groupId - The ID of the group
	* @type {GroupMember[]} Array of group members
	*/
	getGroupMembers(groupId: string): Promise<GroupMember[]>;
	/*
	* Gets all groups a user belongs to
	* @param {string} userId - The ID of the user
	* @type {UserGroup[]} Array of groups
	*/
	getUserGroups(userId: string): Promise<UserGroup[]>;
	/*
	* Gets all groups a member belongs to
	* @param {string} memberId - The ID of the member
	* @param {'user' | 'group'} memberType - The type of the member
	* @type {UserGroup[]} Array of groups
	*/
    getGroupsWhereMember(memberId: string, memberType: 'user' | 'group'): Promise<UserGroup[]>;

	// Permission Management
	/*
	* Returns all permission types
	* @type {PermissionType[]} Array of permission types
	*/
	getAllPermissionTypes(): Promise<PermissionType[]>;
	/*
	* Gets a permission type by name
	* @param {string} name - The name of the permission type
	* @type {PermissionType} Interface of a permission type
	*/
	getPermissionTypeByName(name: string): Promise<PermissionType | undefined>;
	/*
	* Grants a permission to a group for an instance
	* @param {string} groupId - The ID of the group
	* @param {string} instanceId - The ID of the instance
	* @param {number} permissionTypeId - The ID of the permission type
	*/
	grantPermission(groupId: string, instanceId: string, permissionTypeId: number): Promise<void>;
	/*
	* Revokes a permission from a group for an instance
	* @param {string} groupId - The ID of the group
	* @param {string} instanceId - The ID of the instance
	* @param {number} permissionTypeId - The ID of the permission type
	*/
	revokePermission(groupId: string, instanceId: string, permissionTypeId: number): Promise<void>;
	/*
	* Gets all permissions for an instance
	* @param {string} instanceId - The ID of the instance
	* @type {InstancePermission[]} Array of instance permissions
	*/
	getInstancePermissions(instanceId: string): Promise<InstancePermission[]>;
	/*
	* Gets all permissions for a group
	* @param {string} groupId - The ID of the group
	* @type {InstancePermission[]} Array of instance permissions
	*/
	getPermissionsByGroup(groupId: string): Promise<InstancePermission[]>;
	
	// Access Management
	/*
	* Gets all group IDs a user belongs to
	* @param {string} userId - The ID of the user
	* @type {string[]} Array of group IDs
	*/
	getUserGroupIds(userId: string): Promise<string[]>;
	/*
	* Gets all instances a user has access to
	* @param {string} userId - The ID of the user
	* @type {VDIInstance[]} Array of VDI instances
	*/
	getUserInstances(userId: string): Promise<VDIInstance[]>;
	/*
	* Checks if a user has access to an instance
	* @param {string} userId - The ID of the user
	* @param {string} instanceId - The ID of the instance
	* @param {string} permissionName - The name of the permission to check (optional)
	* @type {boolean} True if the user has access, false otherwise
	*/
	hasInstanceAccess(userId: string, instanceId: string, permissionName?: string): Promise<boolean>;
	
	// System/Global Permissions Management
	/*
	* Checks if a user has a global system permission
	* @param {string} userId - The ID of the user
	* @param {string} permissionName - The name of the system permission (e.g. 'user-modification')
	* @type {boolean} True if the user has the system permission
	*/
	hasSystemPermission(userId: string, permissionName: string): Promise<boolean>;
	/*
	* Gets all global system permissions for a group
	* @param {string} groupId - The ID of the group
	* @type {string[]} Array of system permission names
	*/
	getSystemPermissionsByGroup(groupId: string): Promise<string[]>;
	/*
	* Grants a global system permission to a group
	* @param {string} groupId - The ID of the group
	* @param {string} permissionName - The name of the system permission to grant
	*/
	grantSystemPermission(groupId: string, permissionName: string): Promise<void>;
	/*
	* Revokes a global system permission from a group
	* @param {string} groupId - The ID of the group
	* @param {string} permissionName - The name of the system permission to revoke
	*/
	revokeSystemPermission(groupId: string, permissionName: string): Promise<void>;
}

