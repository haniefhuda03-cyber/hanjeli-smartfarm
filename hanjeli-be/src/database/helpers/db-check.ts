/**
 * Database existence check and auto-creation helper.
 *
 * Connects to the PostgreSQL `postgres` maintenance database to check
 * whether the target database exists, and creates it if missing.
 *
 * This uses the raw `pg` driver (already a project dependency) because
 * TypeORM's DataSource requires an existing database to initialize.
 */
import { Client, type ClientConfig } from 'pg';
import { log } from './prompt.js';

export interface DbCheckConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

/**
 * Ensure the target database exists. Creates it if not found.
 *
 * Returns `true` if the database was created, `false` if it already existed.
 *
 * @throws {Error} If the PostgreSQL server is unreachable or credentials are wrong.
 */
export async function ensureDatabaseExists(
  config: DbCheckConfig,
): Promise<boolean> {
  const clientConfig: ClientConfig = {
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    /* Connect to the default 'postgres' maintenance database */
    database: 'postgres',
    /* Short timeout to fail fast if the server is down */
    connectionTimeoutMillis: 10_000,
  };

  const client = new Client(clientConfig);

  try {
    await client.connect();

    /* Check if the target database exists */
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [config.database],
    );

    if (result.rowCount && result.rowCount > 0) {
      log('✓', `Database "${config.database}" exists`);
      return false;
    }

    /*
     * CREATE DATABASE cannot be parameterized ($1) in PostgreSQL.
     * We sanitize the name by allowing only alphanumeric, underscore, and hyphen.
     */
    const safeName = config.database.replace(/[^a-zA-Z0-9_-]/g, '');
    if (safeName !== config.database) {
      throw new Error(
        `Database name "${config.database}" contains invalid characters. ` +
          `Only alphanumeric, underscore, and hyphen are allowed.`,
      );
    }

    await client.query(`CREATE DATABASE "${safeName}"`);
    log('✓', `Database "${safeName}" created`);
    return true;
  } finally {
    await client.end().catch(() => {
      /* Ignore cleanup errors */
    });
  }
}

/**
 * Verify basic connectivity to the target database.
 *
 * Useful after database creation to confirm the DataSource can connect.
 */
export async function verifyConnection(config: DbCheckConfig): Promise<void> {
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();
    const result = await client.query('SELECT current_database() AS db');
    const dbName = result.rows[0]?.db as string;
    log('✓', `Connected to "${dbName}"`);
  } finally {
    await client.end().catch(() => {
      /* Ignore cleanup errors */
    });
  }
}
