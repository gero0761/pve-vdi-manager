import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';
import type { DatabaseAdapter, VDIInstance, UserGroup, GroupMember, PermissionType, InstancePermission, GroupType, User } from './types';
import crypto from 'node:crypto';

const { DB_TYPE, DB_PATH } = env;

let db: Database.Database;

if (DB_TYPE === 'sqlite') {
	db = new Database(DB_PATH || 'vdi-sqlite.db');
	db.pragma('foreign_keys = ON');

	// Initialize schema
	db.exec(`
		CREATE TABLE IF NOT EXISTS instances (
			id TEXT PRIMARY KEY,
			vmid INTEGER NOT NULL,
			type TEXT NOT NULL,
			node TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			sync_status TEXT DEFAULT 'synced'
		)
	`);
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL
		)
	`);
	db.exec(`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			expires_at DATETIME NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`);
	db.exec(`
		CREATE TABLE IF NOT EXISTS group_types (
			id INTEGER PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			is_protected INTEGER NOT NULL DEFAULT 0,
			description TEXT
		)
	`);
	db.exec(`
		CREATE TABLE IF NOT EXISTS groups (
			id TEXT PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			type_id INTEGER NOT NULL,
			description TEXT,
			FOREIGN KEY (type_id) REFERENCES group_types(id) ON DELETE RESTRICT
		)
	`);
	db.exec(`
		CREATE TABLE IF NOT EXISTS group_members (
			group_id TEXT NOT NULL,
			member_id TEXT NOT NULL,
			member_type TEXT NOT NULL,
			PRIMARY KEY (group_id, member_id),
			FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
		)
	`);
	db.exec(`
		CREATE TABLE IF NOT EXISTS permission_types (
			id INTEGER PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			description TEXT
		)
	`);
	db.exec(`
		CREATE TABLE IF NOT EXISTS instance_permissions (
			group_id TEXT NOT NULL,
			instance_id TEXT NOT NULL,
			permission_type_id INTEGER NOT NULL,
			PRIMARY KEY (group_id, instance_id, permission_type_id),
			FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
			FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
			FOREIGN KEY (permission_type_id) REFERENCES permission_types(id) ON DELETE CASCADE
		)
	`);

	// Initialize default group types
	const insertType = db.prepare('INSERT OR IGNORE INTO group_types (id, name, description, is_protected) VALUES (?, ?, ?, ?)');
	insertType.run(0, 'System', 'System group automatically created and managed by the system.', 1);
	insertType.run(1, 'System Role', 'Group that defines system roles.', 1);
	insertType.run(2, 'Base Permission', 'Group that grants base permissions to instances.', 1);
	insertType.run(3, 'Role', 'Custom role that is assigned to users.', 0);
	insertType.run(4, 'Custom Permission', 'Custom permission that is assigned to instances.', 0);
	insertType.run(5, 'Other', 'Other groups.', 0);

	// Initialize System Role Groups
	const insertGroup = db.prepare('INSERT OR IGNORE INTO groups (id, name, type_id, description) VALUES (?, ?, ?, ?)');
	insertGroup.run('system-admin', 'Admin', 1, 'Default administrators group with full system access.');
	insertGroup.run('system-user', 'User', 1, 'Default users group.');

	// Note: Role column is removed. Migration should have been handled in previous versions.

	// Initialize default permission types
	const insertPerm = db.prepare('INSERT OR IGNORE INTO permission_types (id, name, description) VALUES (?, ?, ?)');
	insertPerm.run(1, 'all', 'Full access');
	insertPerm.run(2, 'console', 'Console access only');
	insertPerm.run(3, 'power', 'Start/Stop/Reboot access');
	insertPerm.run(4, 'delete', 'Allow instance deletion');
}

export const sqliteAdapter: DatabaseAdapter = {
	getInstanceById(id: string): Promise<VDIInstance | undefined> {
		return Promise.resolve(db.prepare('SELECT * FROM instances WHERE id = ?').get(id) as VDIInstance | undefined);
	},
	createInstance(instance: VDIInstance): Promise<void> {
		const transaction = db.transaction(() => {
			db.prepare(
				'INSERT INTO instances (id, vmid, type, node, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?)'
			).run(
				instance.id,
				instance.vmid,
				instance.type,
				instance.node,
				instance.created_at,
				instance.sync_status || 'synced'
			);

			const groupId = crypto.randomUUID();
			db.prepare('INSERT INTO groups (id, name, description, type_id) VALUES (?, ?, ?, 0)').run(
				groupId,
				`Access: ${instance.vmid}`,
				`Default access group for instance ${instance.vmid}`
			);

			db.prepare('INSERT INTO instance_permissions (group_id, instance_id, permission_type_id) VALUES (?, ?, ?)').run(
				groupId,
				instance.id,
				1
			);
		});
		transaction();
		return Promise.resolve();
	},
	deleteInstance(id: string): Promise<void> {
		// Find all protected groups linked to this instance (System groups, type_id=0)
		const linkedGroups = db.prepare(`
			SELECT DISTINCT g.id FROM groups g
			JOIN group_types gt ON g.type_id = gt.id
			JOIN instance_permissions ip ON g.id = ip.group_id
			WHERE ip.instance_id = ? AND gt.is_protected = 1
		`).all(id) as { id: string }[];

		const transaction = db.transaction(() => {
			db.prepare('DELETE FROM instances WHERE id = ?').run(id);
			for (const g of linkedGroups) {
				db.prepare('DELETE FROM groups WHERE id = ?').run(g.id);
			}
		});
		transaction();
		return Promise.resolve();
	},
	getAllInstances(): Promise<VDIInstance[]> {
		return Promise.resolve(db.prepare('SELECT * FROM instances ORDER BY vmid ASC').all() as VDIInstance[]);
	},
	updateInstanceSyncStatus(id: string, status: string): Promise<void> {
		db.prepare('UPDATE instances SET sync_status = ? WHERE id = ?').run(status, id);
		return Promise.resolve();
	},

	// User Management
	getUserByUsername(username: string): Promise<User | undefined> {
		return Promise.resolve(db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined);
	},
	getUserById(id: string): Promise<User | undefined> {
		return Promise.resolve(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined);
	},
	createUser(user: User): Promise<void> {
		db.prepare(
			'INSERT INTO users (id, username, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)'
		).run(
			user.id,
			user.username,
			user.password_hash,
			user.first_name,
			user.last_name
		);
		// Add to system-user group by default
		this.addMemberToGroup('system-user', user.id, 'user');
		return Promise.resolve();
	},
	getAllUsers(): Promise<User[]> {
		return Promise.resolve(db.prepare('SELECT * FROM users ORDER BY username ASC').all() as User[]);
	},
	deleteUser(id: string): Promise<void> {
		db.prepare('DELETE FROM users WHERE id = ?').run(id);
		return Promise.resolve();
	},
	updateUser(id: string, user: Partial<User>): Promise<void> {
		const fields = Object.keys(user).filter((k) => k !== 'id');
		if (fields.length === 0) return Promise.resolve();
		const sets = fields.map((f) => `${f} = ?`).join(', ');
		const values = fields.map((f) => (user as any)[f]);
		db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...values, id);
		return Promise.resolve();
	},

	// Session Management
	createSession(session: import('./types').Session): Promise<void> {
		db.prepare(
			'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
		).run(session.id, session.user_id, session.created_at, session.expires_at);
		return Promise.resolve();
	},
	getSessionById(id: string): Promise<import('./types').Session | undefined> {
		return Promise.resolve(db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as import('./types').Session | undefined);
	},
	deleteSession(id: string): Promise<void> {
		db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
		return Promise.resolve();
	},

	// Group Management
	addGroup(group: UserGroup): Promise<void> {
		db.prepare('INSERT INTO groups (id, name, description, type_id) VALUES (?, ?, ?, ?)').run(
			group.id, 
			group.name, 
			group.description, 
			group.type_id !== undefined ? group.type_id : 3 // Default to Role
		);
		return Promise.resolve();
	},
	deleteGroup(id: string): Promise<void> {
		const type = db.prepare(`
			SELECT gt.is_protected 
			FROM groups g 
			JOIN group_types gt ON g.type_id = gt.id 
			WHERE g.id = ?
		`).get(id) as { is_protected: number } | undefined;
		
		if (type?.is_protected) {
			throw new Error('Cannot delete a protected group.');
		}
		db.prepare('DELETE FROM groups WHERE id = ?').run(id);
		return Promise.resolve();
	},
	updateGroup(id: string, group: Partial<UserGroup>): Promise<void> {
		const fields = Object.keys(group).filter((k) => k !== 'id');
		if (fields.length === 0) return Promise.resolve();
		const sets = fields.map((f) => `"${f}" = ?`).join(', ');
		const values = fields.map((f) => (group as any)[f]);
		db.prepare(`UPDATE groups SET ${sets} WHERE id = ?`).run(...values, id);
		return Promise.resolve();
	},
	getAllGroups(): Promise<UserGroup[]> {
		return Promise.resolve(db.prepare('SELECT * FROM groups ORDER BY name ASC').all() as UserGroup[]);
	},
	getAllGroupsDetailed(): Promise<(UserGroup & { type: GroupType })[]> {
		const rows = db.prepare(`
			SELECT g.*, gt.id AS gt_id, gt.name AS gt_name, gt.description AS gt_description, gt.is_protected AS gt_protected
			FROM groups g
			LEFT JOIN group_types gt ON g.type_id = gt.id
			ORDER BY g.name ASC
		`).all() as any[];
		
		return Promise.resolve(rows.map(row => ({
			id: row.id,
			name: row.name,
			type_id: row.type_id,
			description: row.description,
			type: {
				id: row.gt_id,
				name: row.gt_name,
				description: row.gt_description,
				is_protected: !!row.gt_protected
			}
		})));
	},
	getGroupById(id: string): Promise<UserGroup | undefined> {
		return Promise.resolve(db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as UserGroup | undefined);
	},
	getGroupDetailedById(id: string): Promise<UserGroup & { type: GroupType } | undefined> {
		const row = db.prepare(`
			SELECT g.*, gt.id AS gt_id, gt.name AS gt_name, gt.description AS gt_description, gt.is_protected AS gt_protected
			FROM groups g
			LEFT JOIN group_types gt ON g.type_id = gt.id
			WHERE g.id = ?
		`).get(id) as any;
		
		if (!row) return Promise.resolve(undefined);
		return Promise.resolve({
			id: row.id,
			name: row.name,
			type_id: row.type_id,
			description: row.description,
			type: {
				id: row.gt_id,
				name: row.gt_name,
				description: row.gt_description,
				is_protected: !!row.gt_protected
			}
		});
	},
	getAllGroupTypes(): Promise<GroupType[]> {
		const rows = db.prepare('SELECT * FROM group_types ORDER BY name ASC').all() as any[];
		return Promise.resolve(rows.map(r => ({
			id: r.id,
			name: r.name,
			description: r.description,
			is_protected: !!r.is_protected
		})));
	},
	getGroupTypeById(id: string): Promise<GroupType | undefined> {
		const r = db.prepare('SELECT * FROM group_types WHERE id = ?').get(id) as any;
		if (!r) return Promise.resolve(undefined);
		return Promise.resolve({
			id: r.id,
			name: r.name,
			description: r.description,
			is_protected: !!r.is_protected
		});
	},

	// Membership Management
	addMemberToGroup(groupId: string, memberId: string, memberType: 'user' | 'group'): Promise<void> {
		if (memberType === 'group') {
			const type = db.prepare(`
				SELECT gt.is_protected 
				FROM groups g 
				JOIN group_types gt ON g.type_id = gt.id 
				WHERE g.id = ?
			`).get(memberId) as { is_protected: number } | undefined;
			if (type?.is_protected) {
				throw new Error('Protected groups cannot be added as members of other groups.');
			}
		}
		db.prepare('INSERT OR IGNORE INTO group_members (group_id, member_id, member_type) VALUES (?, ?, ?)').run(groupId, memberId, memberType);
		return Promise.resolve();
	},
	removeMemberFromGroup(groupId: string, memberId: string): Promise<void> {
		db.prepare('DELETE FROM group_members WHERE group_id = ? AND member_id = ?').run(groupId, memberId);
		return Promise.resolve();
	},
	getGroupMembers(groupId: string): Promise<GroupMember[]> {
		return Promise.resolve(db.prepare('SELECT * FROM group_members WHERE group_id = ?').all(groupId) as GroupMember[]);
	},
	getUserGroups(userId: string): Promise<UserGroup[]> {
		const rows = db.prepare(`
			WITH RECURSIVE user_groups_cte AS (
				SELECT group_id FROM group_members WHERE member_id = ? AND member_type = 'user'
				UNION
				SELECT gm.group_id
				FROM group_members gm
				JOIN user_groups_cte ug ON gm.member_id = ug.group_id
				WHERE gm.member_type = 'group'
			)
			SELECT g.* FROM groups g
			JOIN user_groups_cte ugc ON g.id = ugc.group_id
		`).all(userId) as UserGroup[];
		return Promise.resolve(rows);
	},
	getGroupsWhereMember(memberId: string, memberType: 'user' | 'group'): Promise<UserGroup[]> {
		return Promise.resolve(db.prepare(`
			SELECT g.* FROM groups g
			JOIN group_members gm ON g.id = gm.group_id
			WHERE gm.member_id = ? AND gm.member_type = ?
		`).all(memberId, memberType) as UserGroup[]);
	},

	// Permission Management
	getAllPermissionTypes(): Promise<PermissionType[]> {
		return Promise.resolve(db.prepare('SELECT * FROM permission_types ORDER BY id ASC').all() as PermissionType[]);
	},
	getPermissionTypeByName(name: string): Promise<PermissionType | undefined> {
		return Promise.resolve(db.prepare('SELECT * FROM permission_types WHERE name = ?').get(name) as PermissionType | undefined);
	},
	grantPermission(groupId: string, instanceId: string, permissionTypeId: number): Promise<void> {
		db.prepare('INSERT OR IGNORE INTO instance_permissions (group_id, instance_id, permission_type_id) VALUES (?, ?, ?)').run(groupId, instanceId, permissionTypeId);
		return Promise.resolve();
	},
	revokePermission(groupId: string, instanceId: string, permissionTypeId: number): Promise<void> {
		if (permissionTypeId === 1) {
			const type = db.prepare(`
				SELECT gt.is_protected 
				FROM groups g 
				JOIN group_types gt ON g.type_id = gt.id 
				WHERE g.id = ?
			`).get(groupId) as { is_protected: number } | undefined;
			if (type?.is_protected) {
				throw new Error('Cannot revoke "all" permission from a protected group.');
			}
		}
		db.prepare('DELETE FROM instance_permissions WHERE group_id = ? AND instance_id = ? AND permission_type_id = ?').run(groupId, instanceId, permissionTypeId);
		return Promise.resolve();
	},
	getInstancePermissions(instanceId: string): Promise<InstancePermission[]> {
		return Promise.resolve(db.prepare('SELECT * FROM instance_permissions WHERE instance_id = ?').all(instanceId) as InstancePermission[]);
	},
	getPermissionsByGroup(groupId: string): Promise<InstancePermission[]> {
		return Promise.resolve(db.prepare('SELECT * FROM instance_permissions WHERE group_id = ?').all(groupId) as InstancePermission[]);
	},

	// Access Management
	getUserGroupIds(userId: string): Promise<string[]> {
		const rows = db.prepare(`
			WITH RECURSIVE user_groups_cte AS (
				SELECT group_id FROM group_members WHERE member_id = ? AND member_type = 'user'
				UNION
				SELECT gm.group_id
				FROM group_members gm
				JOIN user_groups_cte ug ON gm.member_id = ug.group_id
				WHERE gm.member_type = 'group'
			)
			SELECT group_id FROM user_groups_cte
		`).all(userId) as { group_id: string }[];
		return Promise.resolve(rows.map(r => r.group_id));
	},
	async getUserInstances(userId: string): Promise<VDIInstance[]> {
		const groupIds = await this.getUserGroupIds(userId);
		if (groupIds.length === 0) return [];

		const placeholders = groupIds.map(() => '?').join(',');
		const rows = db.prepare(`
			SELECT DISTINCT i.* FROM instances i
			JOIN instance_permissions ip ON i.id = ip.instance_id
			WHERE ip.group_id IN (${placeholders})
			ORDER BY i.vmid ASC
		`).all(...groupIds) as VDIInstance[];
		return Promise.resolve(rows);
	},
	async hasInstanceAccess(userId: string, instance_id: string, permissionName?: string): Promise<boolean> {
		const groupIds = await this.getUserGroupIds(userId);
		if (groupIds.length === 0) return false;

		const placeholders = groupIds.map(() => '?').join(',');
		let query = `
			SELECT 1 FROM instance_permissions ip
		`;
		const params: any[] = [];
		
		if (permissionName) {
			query += ` JOIN permission_types pt ON ip.permission_type_id = pt.id `;
			query += ` WHERE ip.instance_id = ? AND ip.group_id IN (${placeholders}) `;
			query += ` AND (pt.name = ? pt.name = 'all') `;
			params.push(instance_id, ...groupIds, permissionName);
		} else {
			query += ` WHERE ip.instance_id = ? AND ip.group_id IN (${placeholders}) `;
			params.push(instance_id, ...groupIds);
		}
		
		query += ` LIMIT 1 `;
		
		const row = db.prepare(query).get(...params);
		return row !== undefined;
	}
};
