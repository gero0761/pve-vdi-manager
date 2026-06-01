import mysql from 'mysql2/promise';
import { env } from '$env/dynamic/private';
import type { DatabaseAdapter, VDIInstance, UserGroup, GroupMember, PermissionType, InstancePermission, GroupType, User } from './types';
import crypto from 'node:crypto';

const { 
	DB_TYPE,
	MYSQL_HOST,
	MYSQL_PORT,
	MYSQL_USER,
	MYSQL_PASSWORD,
	MYSQL_DATABASE,
	DB_CONNECTION_STRING
} = env;

let pool: mysql.Pool;

if (DB_TYPE === 'mysql') {
	if (DB_CONNECTION_STRING) {
		pool = mysql.createPool(DB_CONNECTION_STRING);
	} else {
		pool = mysql.createPool({
			host: MYSQL_HOST || 'localhost',
			port: parseInt(MYSQL_PORT || '3306', 10),
			user: MYSQL_USER || 'root',
			password: MYSQL_PASSWORD || '',
			database: MYSQL_DATABASE || 'pve_vdi',
			waitForConnections: true,
			connectionLimit: 10,
			queueLimit: 0
		});
	}

	// Initialize schema
	(async () => {
		try {
			const connection = await pool.getConnection();
			await connection.query(`
				CREATE TABLE IF NOT EXISTS instances (
					id VARCHAR(255) PRIMARY KEY,
					vmid INT NOT NULL,
					type VARCHAR(50) NOT NULL,
					node VARCHAR(255) NOT NULL,
					created_at DATETIME NOT NULL,
					sync_status VARCHAR(50) DEFAULT 'synced'
				)
			`);
			await connection.query(`
				CREATE TABLE IF NOT EXISTS users (
					id VARCHAR(255) PRIMARY KEY,
					username VARCHAR(255) UNIQUE NOT NULL,
					password_hash VARCHAR(255) NOT NULL,
					first_name VARCHAR(255) NOT NULL,
					last_name VARCHAR(255) NOT NULL
				)
			`);
			await connection.query(`
				CREATE TABLE IF NOT EXISTS sessions (
					id VARCHAR(255) PRIMARY KEY,
					user_id VARCHAR(255) NOT NULL,
					created_at DATETIME NOT NULL,
					expires_at DATETIME NOT NULL,
					FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
				)
			`);
			await connection.query(`
				CREATE TABLE IF NOT EXISTS group_types (
					id INT PRIMARY KEY,
					name VARCHAR(255) UNIQUE NOT NULL,
					is_protected BOOLEAN NOT NULL DEFAULT FALSE,
					description TEXT
				)
			`);
			await connection.query(`
				CREATE TABLE IF NOT EXISTS \`groups\` (
					id VARCHAR(255) PRIMARY KEY,
					name VARCHAR(255) UNIQUE NOT NULL,
					type_id INT NOT NULL,
					description TEXT,
					FOREIGN KEY (type_id) REFERENCES group_types(id) ON DELETE RESTRICT
				)
			`);
			await connection.query(`
				CREATE TABLE IF NOT EXISTS group_members (
					group_id VARCHAR(255) NOT NULL,
					member_id VARCHAR(255) NOT NULL,
					member_type VARCHAR(50) NOT NULL,
					PRIMARY KEY (group_id, member_id),
					FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE
				)
			`);
			await connection.query(`
				CREATE TABLE IF NOT EXISTS permission_types (
					id INT PRIMARY KEY,
					name VARCHAR(50) UNIQUE NOT NULL,
					description TEXT
				)
			`);
			await connection.query(`
				CREATE TABLE IF NOT EXISTS instance_permissions (
					group_id VARCHAR(255) NOT NULL,
					instance_id VARCHAR(255) NOT NULL,
					permission_type_id INT NOT NULL,
					PRIMARY KEY (group_id, instance_id, permission_type_id),
					FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE,
					FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
					FOREIGN KEY (permission_type_id) REFERENCES permission_types(id) ON DELETE CASCADE
				)
			`);

			// Initialize default group types
			await connection.query(`
				INSERT IGNORE INTO group_types (id, name, description, is_protected) 
				VALUES
					(0, 'System', 'System group automatically created and managed by the system.', TRUE),
					(1, 'System Role', 'Group that defines system roles.', TRUE),
					(2, 'Base Permission', 'Group that grants base permissions to instances.', TRUE),
					(3, 'Role', 'Custom role that is assigned to users.', FALSE),
					(4, 'Custom Permission', 'Custom permission that is assigned to instances.', FALSE),
					(5, 'Other', 'Other groups.', FALSE)
			`);

			// Initialize System Role Groups
			await connection.query(`
				INSERT IGNORE INTO \`groups\` (id, name, type_id, description)
				VALUES
					('system-admin', 'Admin', 1, 'Default administrators group with full system access.'),
					('system-user', 'User', 1, 'Default users group.')
			`);

			// Cleanup: Remove legacy role column if it exists
			try {
				await connection.query('ALTER TABLE users DROP COLUMN role');
			} catch (err) { /* ignore */ }

			// Migration: Move existing data if needed (legacy fallback)
			try {
				await connection.query("UPDATE `groups` SET type_id = 0 WHERE type_id IS NULL AND name LIKE 'Access: %'");
				await connection.query("UPDATE `groups` SET type_id = 3 WHERE type_id IS NULL");
			} catch (err) { /* ignore */ }

			// Initialize default permission types
			await connection.query(`
				INSERT IGNORE INTO permission_types (id, name, description) VALUES 
				(1, 'all', 'Full access'),
				(2, 'console', 'Console access only'),
				(3, 'power', 'Start/Stop/Reboot access'),
				(4, 'delete', 'Allow instance deletion')
			`);

			connection.release();
			console.log('MySQL schema initialized!');
		} catch (err) {
			console.error('Failed to initialize MySQL schema:', err);
		}
	})();
}

export const mysqlAdapter: DatabaseAdapter = {
	async getInstanceById(id: string): Promise<VDIInstance | undefined> {
		const [rows] = await pool.query('SELECT * FROM instances WHERE id = ? LIMIT 1', [id]);
		const results = rows as VDIInstance[];
		return results.length > 0 ? results[0] : undefined;
	},
	async createInstance(instance: VDIInstance): Promise<void> {
		const connection = await pool.getConnection();
		try {
			await connection.beginTransaction();

			await connection.query(
				'INSERT INTO instances (id, vmid, type, node, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?)',
				[
					instance.id,
					instance.vmid,
					instance.type,
					instance.node,
					instance.created_at,
					instance.sync_status || 'synced'
				]
			);

			const groupId = crypto.randomUUID();
			await connection.query('INSERT INTO `groups` (id, name, description, type_id) VALUES (?, ?, ?, 0)', [
				groupId,
				`Access: ${instance.vmid}`,
				`Default access group for instance ${instance.vmid}`
			]);

			await connection.query('INSERT INTO instance_permissions (group_id, instance_id, permission_type_id) VALUES (?, ?, ?)', [
				groupId,
				instance.id,
				1
			]);

			await connection.commit();
		} catch (err) {
			await connection.rollback();
			throw err;
		} finally {
			connection.release();
		}
	},
	async deleteInstance(id: string): Promise<void> {
		const connection = await pool.getConnection();
		try {
			await connection.beginTransaction();

			// Find all protected groups linked to this instance (System groups, type_id=0)
			const [linkedGroups] = await connection.query(`
				SELECT DISTINCT g.id FROM \`groups\` g
				JOIN group_types gt ON g.type_id = gt.id
				JOIN instance_permissions ip ON g.id = ip.group_id
				WHERE ip.instance_id = ? AND gt.is_protected = TRUE
			`, [id]);

			await connection.query('DELETE FROM instances WHERE id = ?', [id]);

			for (const g of linkedGroups as { id: string }[]) {
				await connection.query('DELETE FROM `groups` WHERE id = ?', [g.id]);
			}

			await connection.commit();
		} catch (err) {
			await connection.rollback();
			throw err;
		} finally {
			connection.release();
		}
	},
	async getAllInstances(): Promise<VDIInstance[]> {
		const [rows] = await pool.query('SELECT * FROM instances ORDER BY vmid ASC');
		return rows as VDIInstance[];
	},
	async updateInstanceSyncStatus(id: string, status: string): Promise<void> {
		await pool.query('UPDATE instances SET sync_status = ? WHERE id = ?', [status, id]);
	},
	async updateInstanceNode(id: string, node: string): Promise<void> {
		await pool.query('UPDATE instances SET node = ? WHERE id = ?', [node, id]);
	},

	// User Management
	async getUserByUsername(username: string): Promise<User | undefined> {
		const [rows] = await pool.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
		const results = rows as User[];
		return results.length > 0 ? results[0] : undefined;
	},
	async getUserById(id: string): Promise<User | undefined> {
		const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
		const results = rows as User[];
		return results.length > 0 ? results[0] : undefined;
	},
	async createUser(user: User): Promise<void> {
		await pool.query(
			'INSERT INTO users (id, username, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
			[
				user.id,
				user.username,
				user.password_hash,
				user.first_name,
				user.last_name
			]
		);
		// Add to system-user group by default
		await this.addMemberToGroup('system-user', user.id, 'user');
	},
	async getAllUsers(): Promise<User[]> {
		const [rows] = await pool.query('SELECT * FROM users ORDER BY username ASC');
		return rows as User[];
	},
	async deleteUser(id: string): Promise<void> {
		await pool.query('DELETE FROM users WHERE id = ?', [id]);
	},
	async updateUser(id: string, user: Partial<User>): Promise<void> {
		const fields = Object.keys(user).filter((k) => k !== 'id');
		if (fields.length === 0) return;
		const sets = fields.map((f) => `${f} = ?`).join(', ');
		const values = fields.map((f) => (user as any)[f]);
		await pool.query(`UPDATE users SET ${sets} WHERE id = ?`, [...values, id]);
	},

	// Session Management
	async createSession(session: import('./types').Session): Promise<void> {
		await pool.query(
			'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
			[session.id, session.user_id, session.created_at, session.expires_at]
		);
	},
	async getSessionById(id: string): Promise<import('./types').Session | undefined> {
		const [rows] = await pool.query('SELECT * FROM sessions WHERE id = ? LIMIT 1', [id]);
		const results = rows as import('./types').Session[];
		return results.length > 0 ? results[0] : undefined;
	},
	async deleteSession(id: string): Promise<void> {
		await pool.query('DELETE FROM sessions WHERE id = ?', [id]);
	},

	// Group Management
	async addGroup(group: UserGroup): Promise<void> {
		await pool.query('INSERT INTO `groups` (id, name, description, type_id) VALUES (?, ?, ?, ?)', [
			group.id, 
			group.name, 
			group.description, 
			group.type_id !== undefined ? group.type_id : 3 // Default to Role
		]);
	},
	async deleteGroup(id: string): Promise<void> {
		const [rows] = await pool.query(`
			SELECT gt.is_protected 
			FROM \`groups\` g 
			JOIN group_types gt ON g.type_id = gt.id 
			WHERE g.id = ? LIMIT 1
		`, [id]);
		const results = rows as { is_protected: number }[];
		if (results.length > 0 && results[0].is_protected) {
			throw new Error('Cannot delete a protected group.');
		}
		await pool.query('DELETE FROM `groups` WHERE id = ?', [id]);
	},
	async updateGroup(id: string, group: Partial<UserGroup>): Promise<void> {
		const fields = Object.keys(group).filter((k) => k !== 'id');
		if (fields.length === 0) return;
		const sets = fields.map((f) => `\`${f}\` = ?`).join(', ');
		const values = fields.map((f) => (group as any)[f]);
		await pool.query(`UPDATE \`groups\` SET ${sets} WHERE id = ?`, [...values, id]);
	},
	async getAllGroups(): Promise<UserGroup[]> {
		const [rows] = await pool.query('SELECT * FROM `groups` ORDER BY name ASC');
		return rows as UserGroup[];
	},
	async getAllGroupsDetailed(): Promise<(UserGroup & { type: GroupType })[]> {
		const [rows] = await pool.query(`
			SELECT g.*, gt.id AS gt_id, gt.name AS gt_name, gt.description AS gt_description, gt.is_protected AS gt_protected
			FROM \`groups\` g
			LEFT JOIN group_types gt ON g.type_id = gt.id
			ORDER BY g.name ASC
		`);
		const results = rows as (UserGroup & { gt_id: number; gt_name: string; gt_description: string; gt_protected: number })[];
		return results.map(row => ({
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
		}));
	},
	async getGroupById(id: string): Promise<UserGroup | undefined> {
		const [rows] = await pool.query('SELECT * FROM `groups` WHERE id = ? LIMIT 1', [id]);
		const results = rows as UserGroup[];
		return results.length > 0 ? results[0] : undefined;
	},
	async getGroupDetailedById(id: string): Promise<UserGroup & { type: GroupType } | undefined> {
		const [rows] = await pool.query(`
			SELECT g.*, gt.id AS gt_id, gt.name AS gt_name, gt.description AS gt_description, gt.is_protected AS gt_protected
			FROM \`groups\` g
			LEFT JOIN group_types gt ON g.type_id = gt.id
			WHERE g.id = ?
		`, [id]);
		const results = rows as (UserGroup & { gt_id: number; gt_name: string; gt_description: string; gt_protected: number })[];
		if (results.length === 0) return undefined;
		const row = results[0];
		return {
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
		};
	},
	async getAllGroupTypes(): Promise<GroupType[]> {
		const [rows] = await pool.query('SELECT * FROM group_types ORDER BY name ASC');
		const results = rows as any[];
		return results.map(r => ({
			id: r.id,
			name: r.name,
			description: r.description,
			is_protected: !!r.is_protected
		}));
	},
	async getGroupTypeById(id: string): Promise<GroupType | undefined> {
		const [rows] = await pool.query('SELECT * FROM group_types WHERE id = ?', [id]);
		const results = rows as any[];
		if (results.length === 0) return undefined;
		const r = results[0];
		return {
			id: r.id,
			name: r.name,
			description: r.description,
			is_protected: !!r.is_protected
		};
	},

	// Membership Management
	async addMemberToGroup(groupId: string, memberId: string, memberType: 'user' | 'group'): Promise<void> {
		if (memberType === 'group') {
			const [rows] = await pool.query(`
				SELECT gt.is_protected 
				FROM \`groups\` g 
				JOIN group_types gt ON g.type_id = gt.id 
				WHERE g.id = ? LIMIT 1
			`, [memberId]);
			const results = rows as { is_protected: number }[];
			if (results.length > 0 && results[0].is_protected) {
				throw new Error('Protected groups cannot be added as members of other groups.');
			}
		}
		await pool.query('INSERT IGNORE INTO group_members (group_id, member_id, member_type) VALUES (?, ?, ?)', [groupId, memberId, memberType]);
	},
	async removeMemberFromGroup(groupId: string, memberId: string): Promise<void> {
		await pool.query('DELETE FROM group_members WHERE group_id = ? AND member_id = ?', [groupId, memberId]);
	},
	async getGroupMembers(groupId: string): Promise<GroupMember[]> {
		const [rows] = await pool.query('SELECT * FROM group_members WHERE group_id = ?', [groupId]);
		return rows as GroupMember[];
	},
	async getUserGroups(userId: string): Promise<UserGroup[]> {
		const [rows] = await pool.query(`
			WITH RECURSIVE user_groups_cte AS (
				SELECT group_id FROM group_members WHERE member_id = ? AND member_type = 'user'
				UNION
				SELECT gm.group_id
				FROM group_members gm
				JOIN user_groups_cte ug ON gm.member_id = ug.group_id
				WHERE gm.member_type = 'group'
			)
			SELECT g.* FROM \`groups\` g
			JOIN user_groups_cte ugc ON g.id = ugc.group_id
		`, [userId]);
		return rows as UserGroup[];
	},
	async getGroupsWhereMember(memberId: string, memberType: 'user' | 'group'): Promise<UserGroup[]> {
		const [rows] = await pool.query(`
			SELECT g.* FROM \`groups\` g
			JOIN group_members gm ON g.id = gm.group_id
			WHERE gm.member_id = ? AND gm.member_type = ?
		`, [memberId, memberType]);
		return rows as UserGroup[];
	},

	// Permission Management
	async getAllPermissionTypes(): Promise<PermissionType[]> {
		const [rows] = await pool.query('SELECT * FROM permission_types ORDER BY id ASC');
		return rows as PermissionType[];
	},
	async getPermissionTypeByName(name: string): Promise<PermissionType | undefined> {
		const [rows] = await pool.query('SELECT * FROM permission_types WHERE name = ? LIMIT 1', [name]);
		const results = rows as PermissionType[];
		return results.length > 0 ? results[0] : undefined;
	},
	async grantPermission(groupId: string, instanceId: string, permissionTypeId: number): Promise<void> {
		await pool.query('INSERT IGNORE INTO instance_permissions (group_id, instance_id, permission_type_id) VALUES (?, ?, ?)', [groupId, instanceId, permissionTypeId]);
	},
	async revokePermission(groupId: string, instanceId: string, permissionTypeId: number): Promise<void> {
		if (permissionTypeId === 1) {
			const [rows] = await pool.query(`
				SELECT gt.is_protected 
				FROM \`groups\` g 
				JOIN group_types gt ON g.type_id = gt.id 
				WHERE g.id = ? LIMIT 1
			`, [groupId]);
			const results = rows as { is_protected: number }[];
			if (results.length > 0 && results[0].is_protected) {
				throw new Error('Cannot revoke "all" permission from a protected group.');
			}
		}
		await pool.query('DELETE FROM instance_permissions WHERE group_id = ? AND instance_id = ? AND permission_type_id = ?', [groupId, instanceId, permissionTypeId]);
	},
	async getInstancePermissions(instanceId: string): Promise<InstancePermission[]> {
		const [rows] = await pool.query('SELECT * FROM instance_permissions WHERE instance_id = ?', [instanceId]);
		return rows as InstancePermission[];
	},
	async getPermissionsByGroup(groupId: string): Promise<InstancePermission[]> {
		const [rows] = await pool.query('SELECT * FROM instance_permissions WHERE group_id = ?', [groupId]);
		return rows as InstancePermission[];
	},

	// Access Management
	async getUserGroupIds(userId: string): Promise<string[]> {
		const [rows] = await pool.query(`
			WITH RECURSIVE user_groups_cte AS (
				SELECT group_id FROM group_members WHERE member_id = ? AND member_type = 'user'
				UNION
				SELECT gm.group_id
				FROM group_members gm
				JOIN user_groups_cte ug ON gm.member_id = ug.group_id
				WHERE gm.member_type = 'group'
			)
			SELECT group_id FROM user_groups_cte
		`, [userId]);
		return (rows as any[]).map(r => r.group_id);
	},
	async getUserInstances(userId: string): Promise<VDIInstance[]> {
		const groupIds = await this.getUserGroupIds(userId);
		if (groupIds.length === 0) return [];

		const [rows] = await pool.query(`
			SELECT DISTINCT i.* FROM instances i
			JOIN instance_permissions ip ON i.id = ip.instance_id
			WHERE ip.group_id IN (?)
			ORDER BY i.vmid ASC
		`, [groupIds]);
		return rows as VDIInstance[];
	},
	async hasInstanceAccess(userId: string, instance_id: string, permissionName?: string): Promise<boolean> {
		const groupIds = await this.getUserGroupIds(userId);
		if (groupIds.length === 0) return false;

		let query = `
			SELECT 1 FROM instance_permissions ip
		`;
		const params: any[] = [];
		
		if (permissionName) {
			query += ` JOIN permission_types pt ON ip.permission_type_id = pt.id `;
			query += ` WHERE ip.instance_id = ? AND ip.group_id IN (?) `;
			query += ` AND (pt.name = ? OR pt.name = 'all') `;
			params.push(instance_id, groupIds, permissionName);
		} else {
			query += ` WHERE ip.instance_id = ? AND ip.group_id IN (?) `;
			params.push(instance_id, groupIds);
		}
		
		query += ` LIMIT 1 `;
		
		const [rows] = await pool.query(query, params);
		return (rows as any[]).length > 0;
	}
};
