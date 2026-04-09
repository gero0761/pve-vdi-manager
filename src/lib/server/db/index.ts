import { env } from '$env/dynamic/private';
import { sqliteAdapter } from './sqlite';
import { mysqlAdapter } from './mysql';
import type { DatabaseAdapter } from './types';

const { DB_TYPE } = env;

// Select the database adapter based on configuration
export const db: DatabaseAdapter = DB_TYPE === 'mysql' ? mysqlAdapter : sqliteAdapter;

console.log(`Database initialized using ${DB_TYPE === 'mysql' ? 'MySQL' : 'SQLite'} adapter`);
