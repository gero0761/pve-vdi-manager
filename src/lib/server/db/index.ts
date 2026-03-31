import { sqliteAdapter } from './sqlite';
import type { DatabaseAdapter } from './types';

// We export the selected database adapter here.
// To use MySQL or Postgres in the future, you would implement a new adapter
// matching the DatabaseAdapter interface and export it here instead.

export const db: DatabaseAdapter = sqliteAdapter;
