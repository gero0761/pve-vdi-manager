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
			created_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			expires_at INTEGER NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
			'INSERT INTO instances (id, vmid, type, node, created_at) VALUES (?, ?, ?, ?, ?)'
		);
		stmt.run(instance.id, instance.vmid, instance.type, instance.node, instance.created_at);
	},
	async deleteInstance(id: string): Promise<void> {
		const stmt = db.prepare('DELETE FROM instances WHERE id = ?');
		stmt.run(id);
	},
	async getAllInstances(): Promise<VDIInstance[]> {
		const stmt = db.prepare('SELECT * FROM instances ORDER BY created_at DESC');
		return stmt.all() as VDIInstance[];
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
			'INSERT INTO users (id, username, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)'
		);
		stmt.run(user.id, user.username, user.password_hash, user.first_name, user.last_name);
	},
	
	// Session Management
	async createSession(session: import('./types').Session): Promise<void> {
		const stmt = db.prepare(
			'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
		);
		stmt.run(session.id, session.user_id, session.created_at, session.expires_at);
	},
	async getSessionById(id: string): Promise<import('./types').Session | undefined> {
		const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
		return stmt.get(id) as import('./types').Session | undefined;
	},
	async deleteSession(id: string): Promise<void> {
		const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
		stmt.run(id);
	}
};
