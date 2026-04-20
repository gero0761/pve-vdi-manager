import mysql from 'mysql2/promise';
import { env } from '$env/dynamic/private';
import type { DatabaseAdapter, VDIInstance } from './types';

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
					created_at DATETIME NOT NULL
				)
			`);
			await connection.query(`
				CREATE TABLE IF NOT EXISTS users (
					id VARCHAR(255) PRIMARY KEY,
					username VARCHAR(255) UNIQUE NOT NULL,
					password_hash VARCHAR(255) NOT NULL,
					first_name VARCHAR(255) NOT NULL,
					last_name VARCHAR(255) NOT NULL,
					role VARCHAR(50) DEFAULT 'user' NOT NULL
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
				CREATE TABLE IF NOT EXISTS user_instances (
					user_id VARCHAR(255) NOT NULL,
					instance_id VARCHAR(255) NOT NULL,
					PRIMARY KEY (user_id, instance_id),
					FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
					FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
				)
			`);
			// Try to alter users to add role if we skipped recreation
			try {
				await connection.query("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user' NOT NULL");
			} catch (e) { /* Ignore if it already exists */ }

			connection.release();
			console.log('MySQL schema initialized');
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
		await pool.query(
			'INSERT INTO instances (id, vmid, type, node, created_at) VALUES (?, ?, ?, ?, ?)',
			[instance.id, instance.vmid, instance.type, instance.node, instance.created_at]
		);
	},
	async deleteInstance(id: string): Promise<void> {
		await pool.query('DELETE FROM instances WHERE id = ?', [id]);
	},
	async getAllInstances(): Promise<VDIInstance[]> {
		const [rows] = await pool.query('SELECT * FROM instances ORDER BY created_at DESC');
		return rows as VDIInstance[];
	},
	
	// User Management
	async getUserByUsername(username: string): Promise<import('./types').User | undefined> {
		const [rows] = await pool.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
		const results = rows as import('./types').User[];
		return results.length > 0 ? results[0] : undefined;
	},
	async getUserById(id: string): Promise<import('./types').User | undefined> {
		const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
		const results = rows as import('./types').User[];
		return results.length > 0 ? results[0] : undefined;
	},
	async createUser(user: import('./types').User): Promise<void> {
		await pool.query(
			'INSERT INTO users (id, username, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
			[user.id, user.username, user.password_hash, user.first_name, user.last_name, user.role || 'user']
		);
	},
	async getAllUsers(): Promise<import('./types').User[]> {
		const [rows] = await pool.query('SELECT * FROM users ORDER BY username ASC');
		return rows as import('./types').User[];
	},
	async deleteUser(id: string): Promise<void> {
		await pool.query('DELETE FROM users WHERE id = ?', [id]);
	},
	async updateUser(id: string, user: Partial<import('./types').User>): Promise<void> {
		const fields = Object.keys(user).filter(k => k !== 'id');
		if (fields.length === 0) return;
		
		const sets = fields.map(f => `${f} = ?`).join(', ');
		const values = fields.map(f => (user as any)[f]);
		
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
	
	// Access Management
	async assignInstanceToUser(userId: string, instanceId: string): Promise<void> {
		await pool.query('INSERT IGNORE INTO user_instances (user_id, instance_id) VALUES (?, ?)', [userId, instanceId]);
	},
	async removeInstanceFromUser(userId: string, instanceId: string): Promise<void> {
		await pool.query('DELETE FROM user_instances WHERE user_id = ? AND instance_id = ?', [userId, instanceId]);
	},
	async getUserInstances(userId: string): Promise<VDIInstance[]> {
		const [rows] = await pool.query(`
			SELECT i.* FROM instances i
			JOIN user_instances ui ON i.id = ui.instance_id
			WHERE ui.user_id = ?
		`, [userId]);
		return rows as VDIInstance[];
	},
	async hasInstanceAccess(userId: string, instanceId: string): Promise<boolean> {
		const [rows] = await pool.query('SELECT 1 FROM user_instances WHERE user_id = ? AND instance_id = ? LIMIT 1', [userId, instanceId]);
		return (rows as any[]).length > 0;
	}
};
