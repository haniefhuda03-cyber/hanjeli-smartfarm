#!/usr/bin/env node
/**
 * Hanjeli SmartFarm — Unified Database Setup CLI
 *
 * Single command to:
 *   1. Check/create database
 *   2. Initialize/upgrade schema (idempotent, no migrations)
 *   3. Seed admin user (interactive password prompt)
 *   4. Seed dev data (non-production only)
 *   5. Print status summary
 *
 * Usage:
 *   npm run db:setup                              # Interactive mode
 *   npm run db:setup -- --admin-password=Secret    # Non-interactive (CI/CD)
 *   npm run db:setup -- --skip-seed                # Only migrate, no seed
 *   npm run db:setup -- --reset-password           # Reset admin password
 *
 * Password is NEVER stored in env files — only in memory during execution.
 */
import 'dotenv/config';
import { isEmail } from 'class-validator';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../config/data-source.js';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} from '../../common/constants/password.constants.js';
import { ensureDatabaseExists } from '../helpers/db-check.js';
import { ask, askPassword, log, phase, color } from '../helpers/prompt.js';
import { initializeSchema } from '../schema-init.js';
import { AdminSeeder } from '../seeders/admin.seeder.js';
import { DevDataSeeder } from '../seeders/dev-data.seeder.js';
import { User } from '../../entities/user.entity.js';
import type { SeederResult } from '../seeders/seeder.interface.js';

/* ── CLI argument parsing ── */

interface CliArgs {
  adminPassword?: string;
  adminEmail?: string;
  adminName?: string;
  skipSeed: boolean;
  skipDevSeed: boolean;
  resetPassword: boolean;
  nonInteractive: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    skipSeed: false,
    skipDevSeed: false,
    resetPassword: false,
    nonInteractive: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--admin-password=')) {
      result.adminPassword = arg.slice('--admin-password='.length);
    } else if (arg.startsWith('--admin-email=')) {
      result.adminEmail = arg.slice('--admin-email='.length);
    } else if (arg.startsWith('--admin-name=')) {
      result.adminName = arg.slice('--admin-name='.length);
    } else if (arg === '--skip-seed') {
      result.skipSeed = true;
    } else if (arg === '--skip-dev-seed') {
      result.skipDevSeed = true;
    } else if (arg === '--reset-password') {
      result.resetPassword = true;
    } else if (arg === '--non-interactive') {
      result.nonInteractive = true;
    }
  }

  /* Auto-detect non-interactive if password provided */
  if (result.adminPassword) {
    result.nonInteractive = true;
  }

  return result;
}

/* ── Password validation ── */

const INSECURE_PASSWORDS = new Set([
  'change-this-before-seeding',
  'ganti-dengan-password-admin-yang-kuat',
  'change-me',
  'password',
  'admin123',
  '12345678',
  'qwerty123',
]);

/**
 * Validasi kekuatan kata sandi — SAMA dengan kebijakan aplikasi & tab Akun
 * Pengguna (min 8 + huruf besar + angka, lihat password.constants.ts),
 * ditambah blokir kata sandi umum khusus CLI.
 */
function validatePassword(password: string): string | null {
  if (!password || password.trim().length === 0) {
    return 'Password tidak boleh kosong';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password minimal ${PASSWORD_MIN_LENGTH} karakter`;
  }
  if (!PASSWORD_POLICY_REGEX.test(password)) {
    return PASSWORD_POLICY_MESSAGE;
  }
  if (INSECURE_PASSWORDS.has(password.toLowerCase())) {
    return 'Password terlalu umum/tidak aman, gunakan password yang lebih kuat';
  }
  return null; /* valid */
}

/** Validasi pola email — memakai validator yang sama dengan DTO (`@IsEmail`). */
function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email tidak boleh kosong';
  if (!isEmail(trimmed)) return 'Format email tidak valid';
  return null; /* valid */
}

/* ── Main entry point ── */

async function main(): Promise<void> {
  console.log(`
${color.bold}🗄️  Hanjeli SmartFarm — Database Setup${color.reset}
${'─'.repeat(42)}
`);

  const args = parseArgs();

  /* ───────────────────────────────────── */
  /*  Phase 1: Database existence check   */
  /* ───────────────────────────────────── */
  phase(1, 'Checking database...');

  const dbConfig = {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'hanjeli_admin',
    password: process.env.DB_PASSWORD ?? 'hanjeli_password_super_aman',
    database: process.env.DB_NAME ?? 'hanjeli_smartfarm_db',
  };

  try {
    await ensureDatabaseExists(dbConfig);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log('✗', `Tidak bisa terhubung ke PostgreSQL: ${message}`);
    log('ℹ', 'Pastikan PostgreSQL berjalan dan kredensial di .env benar');
    log(
      'ℹ',
      `Host: ${dbConfig.host}:${dbConfig.port}, User: ${dbConfig.username}`,
    );
    process.exitCode = 1;
    return;
  }

  /* ───────────────────────────────────── */
  /*  Phase 2: Initialize schema          */
  /* ───────────────────────────────────── */
  phase(2, 'Initializing schema...');

  const dataSource = new DataSource(dataSourceOptions);

  try {
    await dataSource.initialize();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log('✗', `Gagal menginisialisasi DataSource: ${message}`);
    process.exitCode = 1;
    return;
  }

  try {
    /* Buat/upgrade skema secara idempotent (pengganti migrations) */
    await initializeSchema(dataSource);
    log('✓', 'Skema database siap');

    /* ───────────────────────────────────── */
    /*  Phase 3: Seed admin user            */
    /* ───────────────────────────────────── */
    if (!args.skipSeed) {
      phase(3, 'Seeding admin data...');

      const adminOptions: Record<string, string> = {};
      const userRepo = dataSource.getRepository(User);

      // Check if ANY admin already exists
      const existingAnyAdmin = await userRepo.findOne({
        where: { role: 'Admin' },
      });

      if (
        existingAnyAdmin &&
        !args.resetPassword &&
        !args.adminEmail &&
        !args.adminName
      ) {
        log(
          '○',
          `Admin account already exists (${existingAnyAdmin.email}). Skipping interactive prompts.`,
        );
        adminOptions.email = existingAnyAdmin.email;
        adminOptions.name = existingAnyAdmin.name;
      } else {
        /* Determine admin email — validasi pola (sama seperti tab Akun Pengguna) */
        if (args.adminEmail) {
          const emailError = validateEmail(args.adminEmail);
          if (emailError) {
            log('✗', `Email tidak valid: ${emailError}`);
            process.exitCode = 1;
            return;
          }
          adminOptions.email = args.adminEmail;
        } else if (!args.nonInteractive) {
          let email = '';
          let emailAttempts = 0;
          const maxEmailAttempts = 3;
          while (emailAttempts < maxEmailAttempts) {
            email = await ask(
              'Admin Email',
              existingAnyAdmin ? existingAnyAdmin.email : 'admin@hanjeli.local',
            );
            const emailError = validateEmail(email);
            if (!emailError) break;
            log('⚠', emailError);
            emailAttempts++;
            if (emailAttempts >= maxEmailAttempts) {
              log('✗', 'Terlalu banyak percobaan. Dibatalkan.');
              process.exitCode = 1;
              return;
            }
          }
          adminOptions.email = email;
        }

        /* Determine admin name */
        if (args.adminName) {
          adminOptions.name = args.adminName;
        } else if (!args.nonInteractive) {
          adminOptions.name = await ask(
            'Admin Name',
            existingAnyAdmin ? existingAnyAdmin.name : 'Hanjeli Admin',
          );
        }
      }

      /* Check if the specific admin email already exists to decide if password is needed */
      const email = (adminOptions.email ?? 'admin@hanjeli.local')
        .trim()
        .toLowerCase();
      const existingAdmin = await userRepo.findOne({
        where: { email },
      });

      const needsPassword = !existingAdmin || args.resetPassword;

      if (needsPassword) {
        /* Get password */
        if (args.adminPassword) {
          const validationError = validatePassword(args.adminPassword);
          if (validationError) {
            log('✗', `Password tidak valid: ${validationError}`);
            process.exitCode = 1;
            return;
          }
          adminOptions.password = args.adminPassword;
        } else if (!args.nonInteractive) {
          /* Prompt kata sandi — TANPA konfirmasi ulang & tanpa kata sandi lama.
             Sesuai kebijakan CLI (setara pembuatan akun oleh admin di tab
             Akun Pengguna): cukup satu input yang memenuhi kebijakan. */
          let password = '';
          let attempts = 0;
          const maxAttempts = 3;

          while (attempts < maxAttempts) {
            password = await askPassword('Admin Password');
            const validationError = validatePassword(password);

            if (!validationError) break; /* Password valid */

            log('⚠', validationError);
            attempts++;
            if (attempts >= maxAttempts) {
              log('✗', 'Terlalu banyak percobaan. Dibatalkan.');
              process.exitCode = 1;
              return;
            }
          }

          adminOptions.password = password;
        } else {
          /* Non-interactive without password when admin doesn't exist */
          log('✗', 'Admin belum ada dan --admin-password tidak diberikan');
          log(
            'ℹ',
            'Gunakan: npm run db:setup -- --admin-password="YourPassword"',
          );
          process.exitCode = 1;
          return;
        }
      }

      if (args.resetPassword) {
        adminOptions.resetPassword = 'true';
      }

      /* Run admin seeder */
      const adminSeeder = new AdminSeeder();
      const adminResults = await adminSeeder.run(dataSource, adminOptions);
      printResults(adminResults);

      /* ───────────────────────────────────── */
      /*  Phase 4: Seed dev data              */
      /* ───────────────────────────────────── */
      if (!args.skipDevSeed && process.env.NODE_ENV !== 'production') {
        phase(4, 'Seeding development data...');

        const devSeeder = new DevDataSeeder();
        const devResults = await devSeeder.run(dataSource);
        printResults(devResults);
      } else if (process.env.NODE_ENV === 'production') {
        phase(4, 'Development data');
        log('○', 'Skipped — NODE_ENV=production');
      }
    } else {
      log('ℹ', 'Seed skipped (--skip-seed flag)');
    }

    /* ───────────────────────────────────── */
    /*  Phase 5: Summary                    */
    /* ───────────────────────────────────── */
    console.log(`\n${'─'.repeat(42)}`);
    console.log(
      `${color.green}${color.bold}✅ Database setup complete!${color.reset}`,
    );
    console.log('');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log('✗', `Error: ${message}`);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

/* ── Helpers ── */

function printResults(results: SeederResult[]): void {
  for (const result of results) {
    if (result.changed) {
      log('✓', result.message);
    } else {
      log('○', result.message);
    }
  }
}

/* ── Run ── */

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `\n${color.red}[db-setup] Fatal error: ${message}${color.reset}`,
  );
  process.exitCode = 1;
});
