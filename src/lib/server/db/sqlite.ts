import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';
import type { DatabaseAdapter, VDIInstance, UserGroup, GroupMember, PermissionType, InstancePermission } from './types';
import crypto from 'node:crypto';

const { DB_TYPE } = env;

let db: Database.Database;

if (DB_TYPE !== 'mysql') {
	db = new Database('data.db');
	db.pragma('journal_mode = WAL');

	// Initialize schema
	db.exec(`
		CREATE TABLE IF NOT EXISTS instances (
			id TEXT PRIMARY KEY,
			vmid INTEGER NOT NULL,
			type TEXT NOT NULL,
			node TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			sync_status TEXT DEFAULT 'synced'
		);
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			role TEXT DEFAULT 'user' NOT NULL
		);
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			expires_at DATETIME NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);
		CREATE TABLE IF NOT EXISTS groups (
			id TEXT PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			description TEXT,
			"protected" INTEGER DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS group_members (
			group_id TEXT NOT NULL,
			member_id TEXT NOT NULL,
			member_type TEXT NOT NULL, -- 'user' or 'group'
			PRIMARY KEY (group_id, member_id),
			FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
		);
		CREATE TABLE IF NOT EXISTS permission_types (
			id INTEGER PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			description TEXT
		);
		CREATE TABLE IF NOT EXISTS instance_permissions (
			group_id TEXT NOT NULL,
			instance_id TEXT NOT NULL,
			permission_type_id INTEGER NOT NULL,
			PRIMARY KEY (group_id, instance_id, permission_type_id),
			FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
			FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
			FOREIGN KEY (permission_type_id) REFERENCES permission_types(id) ON DELETE CASCADE
		);
	`);

    // Migration: Ensure UNIQUE constraint on groups(name) for existing DBs
    try {
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_name ON groups(name)');
    } catch (e) { /* Ignore */ }

	// Migration: Handle rename from is_system/is_protected to "protected"
	try {
		db.exec('ALTER TABLE groups RENAME COLUMN is_system TO "protected"');
	} catch (e) { /* Ignore if it fails */ }
    try {
		db.exec('ALTER TABLE groups RENAME COLUMN is_protected TO "protected"');
	} catch (e) { /* Ignore if it fails */ }
	try {
		db.exec('ALTER TABLE groups ADD COLUMN "protected" INTEGER DEFAULT 0');
	} catch (e) { /* Column already exists */ }

	// Migration: Mark existing Access: * groups as protected groups
	db.exec("UPDATE groups SET \"protected\" = 1 WHERE name LIKE 'Access: %'");

	// Initialize default permission types
	db.exec(`
		INSERT OR IGNORE INTO permission_types (id, name, description) VALUES 
		(1, 'all', 'Full access'),
		(2, 'console', 'Console access only'),
		(3, 'power', 'Start/Stop/Reboot access'),
		(4, 'delete', 'Allow instance deletion');
	`);
	
	// Cleanup old tables if they exist
	try {
		db.exec('DROP TABLE IF EXISTS group_instances');
		db.exec('DROP TABLE IF EXISTS user_instances');
	} catch (e) { /* Ignore */ }
}

export const sqliteAdapter: DatabaseAdapter = {
	async getInstanceById(id: string): Promise<VDIInstance | undefined> {
		const stmt = db.prepare('SELECT * FROM instances WHERE id = ?');
		return stmt.get(id) as VDIInstance | undefined;
	},
	async createInstance(instance: VDIInstance): Promise<void> {
		const transaction = db.transaction(() => {
			// 1. Create instance
			const stmtInstance = db.prepare(
				'INSERT INTO instances (id, vmid, type, node, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?)'
			);
			stmtInstance.run(
				instance.id,
				instance.vmid,
				instance.type,
				instance.node,
				instance.created_at.toISOString(),
				instance.sync_status || 'synced'
			);

			// 2. Create automatic access group
			const groupId = crypto.randomUUID();
			const stmtGroup = db.prepare('INSERT INTO groups (id, name, description, "protected") VALUES (?, ?, ?, 1)');
			stmtGroup.run(groupId, `Access: ${instance.vmid}`, `Default access group for instance ${instance.vmid}`);

			// 3. Grant 'all' permission (ID 1)
			const stmtPerm = db.prepare('INSERT INTO instance_permissions (group_id, instance_id, permission_type_id) VALUES (?, ?, ?)');
			stmtPerm.run(groupId, instance.id, 1);
		});

		transaction();
	},
	async deleteInstance(id: string): Promise<void> {
		const transaction = db.transaction(() => {
            // Find all protected groups linked to this instance (not just 'all' perms)
            const linkedGroups = db.prepare(`
                SELECT DISTINCT g.id FROM groups g
                JOIN instance_permissions ip ON g.id = ip.group_id
                WHERE ip.instance_id = ? AND g."protected" = 1
            `).all(id) as { id: string }[];

            // Delete the instance first (cascades perms)
            db.prepare('DELETE FROM instances WHERE id = ?').run(id);

            // Delete the linked protected groups
            for (const g of linkedGroups) {
                db.prepare('DELETE FROM groups WHERE id = ?').run(g.id);
            }
        });
        transaction();
	},
	async getAllInstances(): Promise<VDIInstance[]> {
		const stmt = db.prepare('SELECT * FROM instances ORDER BY vmid ASC');
		return stmt.all() as VDIInstance[];
	},
	async updateInstanceSyncStatus(id: string, status: string): Promise<void> {
		const stmt = db.prepare('UPDATE instances SET sync_status = ? WHERE id = ?');
		stmt.run(status, id);
	},

	// User Management
	async getUserByUsername(username: string): Promise<import('./types').User | undefined> {
		const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
		return stmt.get(username) as import('./types').User | undefined;
	},
	async getUserById(id: string): Promise<import('./types').User | undefined> {
		const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
		return stmt.get(id) as import('./types').User | undefined;
	},
	async createUser(user: import('./types').User): Promise<void> {
		const stmt = db.prepare(
			'INSERT INTO users (id, username, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)'
		);
		stmt.run(
			user.id,
			user.username,
			user.password_hash,
			user.first_name,
			user.last_name,
			user.role || 'user'
		);
	},
	async getAllUsers(): Promise<import('./types').User[]> {
		const stmt = db.prepare('SELECT * FROM users ORDER BY username ASC');
		return stmt.all() as import('./types').User[];
	},
	async deleteUser(id: string): Promise<void> {
		const stmt = db.prepare('DELETE FROM users WHERE id = ?');
		stmt.run(id);
	},
	async updateUser(id: string, user: Partial<import('./types').User>): Promise<void> {
		const fields = Object.keys(user).filter((k) => k !== 'id');
		if (fields.length === 0) return;
		const sets = fields.map((f) => `${f} = ?`).join(', ');
		const values = fields.map((f) => (user as any)[f]);
		const stmt = db.prepare(`UPDATE users SET ${sets} WHERE id = ?`);
		stmt.run(...values, id);
	},

	// Session Management
	async createSession(session: import('./types').Session): Promise<void> {
		const stmt = db.prepare(
			'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
		);
		stmt.run(
			session.id,
			session.user_id,
			session.created_at.toISOString(),
			session.expires_at.toISOString()
		);
	},
	async getSessionById(id: string): Promise<import('./types').Session | undefined> {
		const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
		return stmt.get(id) as import('./types').Session | undefined;
	},
	async deleteSession(id: string): Promise<void> {
		const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
		stmt.run(id);
	},

	// Group Management
	async addGroup(group: UserGroup): Promise<void> {
		const stmt = db.prepare('INSERT INTO groups (id, name, description, "protected") VALUES (?, ?, ?, ?)');
		stmt.run(group.id, group.name, group.description, group.protected || 0);
	},
	async deleteGroup(id: string): Promise<void> {
		// Safeguard: Check if group is protected
		const group = db.prepare('SELECT "protected" FROM groups WHERE id = ?').get(id) as { protected: number } | undefined;
		if (group?.protected === 1) {
			throw new Error('Cannot delete a protected access group.');
		}
		const stmt = db.prepare('DELETE FROM groups WHERE id = ?');
		stmt.run(id);
	},
	async updateGroup(id: string, group: Partial<UserGroup>): Promise<void> {
		const fields = Object.keys(group).filter((k) => k !== 'id');
		if (fields.length === 0) return;
		const sets = fields.map((f) => `"${f}" = ?`).join(', ');
		const values = fields.map((f) => (group as any)[f]);
		const stmt = db.prepare(`UPDATE groups SET ${sets} WHERE id = ?`);
		stmt.run(...values, id);
	},
	async getAllGroups(): Promise<UserGroup[]> {
		const stmt = db.prepare('SELECT * FROM groups ORDER BY name ASC');
		return stmt.all() as UserGroup[];
	},
	async getGroupById(id: string): Promise<UserGroup | undefined> {
		const stmt = db.prepare('SELECT * FROM groups WHERE id = ?');
		return stmt.get(id) as UserGroup | undefined;
	},

	// Membership Management
	async addMemberToGroup(groupId: string, memberId: string, memberType: 'user' | 'group'): Promise<void> {
		if (memberType === 'group') {
			const memberGroup = db.prepare('SELECT "protected" FROM groups WHERE id = ?').get(memberId) as { protected: number } | undefined;
			if (memberGroup?.protected === 1) {
				throw new Error('Protected access groups cannot be added as members of other groups.');
			}
		}
		const stmt = db.prepare('INSERT OR IGNORE INTO group_members (group_id, member_id, member_type) VALUES (?, ?, ?)');
		stmt.run(groupId, memberId, memberType);
	},
	async removeMemberFromGroup(groupId: string, memberId: string): Promise<void> {
		const stmt = db.prepare('DELETE FROM group_members WHERE group_id = ? AND member_id = ?');
		stmt.run(groupId, memberId);
	},
	async getGroupMembers(groupId: string): Promise<GroupMember[]> {
		const stmt = db.prepare('SELECT * FROM group_members WHERE group_id = ?');
		return stmt.all(groupId) as GroupMember[];
	},
	async getUserGroups(userId: string): Promise<UserGroup[]> {
		const stmt = db.prepare(`
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
		`);
		return stmt.all(userId) as UserGroup[];
	},
    async getGroupsWhereMember(memberId: string, memberType: 'user' | 'group'): Promise<UserGroup[]> {
        const stmt = db.prepare(`
            SELECT g.* FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.member_id = ? AND gm.member_type = ?
        `);
        return stmt.all(memberId, memberType) as UserGroup[];
    },

	// Permission Management
	async getAllPermissionTypes(): Promise<PermissionType[]> {
		const stmt = db.prepare('SELECT * FROM permission_types ORDER BY id ASC');
		return stmt.all() as PermissionType[];
	},
	async getPermissionTypeByName(name: string): Promise<PermissionType | undefined> {
		const stmt = db.prepare('SELECT * FROM permission_types WHERE name = ?');
		return stmt.get(name) as PermissionType | undefined;
	},
	async grantPermission(groupId: string, instanceId: string, permissionTypeId: number): Promise<void> {
		const stmt = db.prepare('INSERT OR IGNORE INTO instance_permissions (group_id, instance_id, permission_type_id) VALUES (?, ?, ?)');
		stmt.run(groupId, instanceId, permissionTypeId);
	},
	async revokePermission(groupId: string, instanceId: string, permissionTypeId: number): Promise<void> {
		// Safeguard: Do not allow revoking 'all' (ID 1) if the group is protected
		if (permissionTypeId === 1) {
			const group = db.prepare('SELECT "protected" FROM groups WHERE id = ?').get(groupId) as { protected: number } | undefined;
			if (group?.protected === 1) {
				throw new Error('Cannot revoke "all" permission from a protected access group.');
			}
		}
		const stmt = db.prepare('DELETE FROM instance_permissions WHERE group_id = ? AND instance_id = ? AND permission_type_id = ?');
		stmt.run(groupId, instanceId, permissionTypeId);
	},
	async getInstancePermissions(instanceId: string): Promise<InstancePermission[]> {
		const stmt = db.prepare('SELECT * FROM instance_permissions WHERE instance_id = ?');
		return stmt.all(instanceId) as InstancePermission[];
	},

	async getPermissionsByGroup(groupId: string): Promise<InstancePermission[]> {
		const stmt = db.prepare('SELECT * FROM instance_permissions WHERE group_id = ?');
		return stmt.all(groupId) as InstancePermission[];
	},

	// Access Management
	async getUserGroupIds(userId: string): Promise<string[]> {
		const stmt = db.prepare(`
			WITH RECURSIVE user_groups_cte AS (
				SELECT group_id FROM group_members WHERE member_id = ? AND member_type = 'user'
				UNION
				SELECT gm.group_id
				FROM group_members gm
				JOIN user_groups_cte ug ON gm.member_id = ug.group_id
				WHERE gm.member_type = 'group'
			)
			SELECT group_id FROM user_groups_cte
		`);
		return stmt.all(userId).map((r: any) => r.group_id);
	},
	async getUserInstances(userId: string): Promise<VDIInstance[]> {
		const groupIds = await this.getUserGroupIds(userId);
		if (groupIds.length === 0) return [];

		const placeholders = groupIds.map(() => '?').join(',');
		const stmt = db.prepare(`
			SELECT DISTINCT i.* FROM instances i
			JOIN instance_permissions ip ON i.id = ip.instance_id
			WHERE ip.group_id IN (${placeholders})
			ORDER BY i.vmid ASC
		`);
		return stmt.all(...groupIds) as VDIInstance[];
	},
	async hasInstanceAccess(userId: string, instanceId: string, permissionName?: string): Promise<boolean> {
		const groupIds = await this.getUserGroupIds(userId);
		if (groupIds.length === 0) return false;

		const placeholders = groupIds.map(() => '?').join(',');
		let query = `
			SELECT 1 FROM instance_permissions ip
		`;
		const params: any[] = [instanceId, ...groupIds];
		
		if (permissionName) {
			query += ` JOIN permission_types pt ON ip.permission_type_id = pt.id `;
			query += ` WHERE ip.instance_id = ? AND ip.group_id IN (${placeholders}) `;
			query += ` AND (pt.name = ? OR pt.name = 'all') `;
			params.push(permissionName);
		} else {
			query += ` WHERE ip.instance_id = ? AND ip.group_id IN (${placeholders}) `;
		}
		
		query += ` LIMIT 1 `;
		const stmt = db.prepare(query);
		return stmt.get(...params) !== undefined;
	}
};
