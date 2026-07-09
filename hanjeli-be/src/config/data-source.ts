import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as entities from '../entities/index.js';

/**
 * TypeORM DataSource — dipakai aplikasi dan CLI db-setup.
 *
 * Skema TIDAK dikelola lewat migrations ataupun synchronize:
 * seluruh DDL dibuat/di-upgrade otomatis oleh
 * `src/database/schema-init.ts` saat bootstrap (lihat main.ts).
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'hanjeli_admin',
  password: process.env.DB_PASSWORD ?? 'hanjeli_password_super_aman',
  database: process.env.DB_NAME ?? 'hanjeli_smartfarm_db',

  entities: Object.values(entities),

  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
