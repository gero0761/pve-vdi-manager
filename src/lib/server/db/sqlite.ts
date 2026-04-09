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
		)
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
	}
};
