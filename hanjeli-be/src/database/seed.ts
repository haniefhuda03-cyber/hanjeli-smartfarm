import AppDataSource from '../config/data-source.js';
import { ensureAdminUser } from './admin-bootstrap.js';

/**
 * CLI seeding admin (npm run seed:run).
 *
 * Catatan: sejak seeding admin juga berjalan otomatis saat aplikasi start
 * (lihat main.ts → prepareDatabase), CLI ini hanya diperlukan untuk seeding
 * manual tanpa menjalankan server.
 */
async function main(): Promise<void> {
  await AppDataSource.initialize();

  try {
    const email = await ensureAdminUser(AppDataSource);
    if (email) {
      console.log(`[seed] Admin ready: ${email}`);
    } else {
      console.log('[seed] SEED_ADMIN_EMAIL tidak dikonfigurasi — dilewati');
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[seed] Failed: ${message}`);
  process.exitCode = 1;
});
