import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';
import type { DatabaseAdapter, VDIInstance } from './types';

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
		CREATE TABLE IF NOT EXISTS user_instances (
			user_id TEXT NOT NULL,
			instance_id TEXT NOT NULL,
			PRIMARY KEY (user_id, instance_id),
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
		);
	`);
}

export const sqliteAdapter: DatabaseAdapter = {
	async getInstanceById(id: string): Promise<VDIInstance | undefined> {
		const stmt = db.prepare('SELECT * FROM instances WHERE id = ?');
		return stmt.get(id) as VDIInstance | undefined;
	},
	async createInstance(instance: VDIInstance): Promise<void> {
		const stmt = db.prepare(
			'INSERT INTO instances (id, vmid, type, node, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?)'
		);
		stmt.run(
			instance.id,
			instance.vmid,
			instance.type,
			instance.node,
			instance.created_at,
			instance.sync_status || 'synced'
		);
	},
	async deleteInstance(id: string): Promise<void> {
		const stmt = db.prepare('DELETE FROM instances WHERE id = ?');
		stmt.run(id);
	},
	async getAllInstances(): Promise<VDIInstance[]> {
		const stmt = db.prepare('SELECT * FROM instances ORDER BY created_at DESC');
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

	// Access Management
	async assignInstanceToUser(userId: string, instanceId: string): Promise<void> {
		const stmt = db.prepare(
			'INSERT OR IGNORE INTO user_instances (user_id, instance_id) VALUES (?, ?)'
		);
		stmt.run(userId, instanceId);
	},
	async removeInstanceFromUser(userId: string, instanceId: string): Promise<void> {
		const stmt = db.prepare('DELETE FROM user_instances WHERE user_id = ? AND instance_id = ?');
		stmt.run(userId, instanceId);
	},
	async getUserInstances(userId: string): Promise<VDIInstance[]> {
		const stmt = db.prepare(`
			SELECT i.* FROM instances i
			JOIN user_instances ui ON i.id = ui.instance_id
			WHERE ui.user_id = ?
		`);
		return stmt.all(userId) as VDIInstance[];
	},
	async hasInstanceAccess(userId: string, instanceId: string): Promise<boolean> {
		const stmt = db.prepare('SELECT 1 FROM user_instances WHERE user_id = ? AND instance_id = ?');
		return stmt.get(userId, instanceId) !== undefined;
	}
};
