import Database from 'better-sqlite3';
import type { DatabaseAdapter, VDIInstance } from './types';

const db = new Database('data.db');

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

export const sqliteAdapter: DatabaseAdapter = {
	getInstanceById(id: string): VDIInstance | undefined {
		const stmt = db.prepare('SELECT * FROM instances WHERE id = ?');
		return stmt.get(id) as VDIInstance | undefined;
	},
	createInstance(instance: VDIInstance): void {
		const stmt = db.prepare('INSERT INTO instances (id, vmid, type, node, created_at) VALUES (?, ?, ?, ?, ?)');
		stmt.run(instance.id, instance.vmid, instance.type, instance.node, instance.created_at);
	},
	getAllInstances(): VDIInstance[] {
		const stmt = db.prepare('SELECT * FROM instances ORDER BY created_at DESC');
		return stmt.all() as VDIInstance[];
	}
};
