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
					created_at BIGINT NOT NULL
				)
			`);
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
	}
};
