/**
 * Seeder interface contract.
 *
 * All seeders must implement this interface for consistent
 * execution and status reporting.
 */
import type { DataSource } from 'typeorm';

export interface SeederResult {
  /** Human-readable description of what was done */
  message: string;
  /** Whether any data was actually inserted (false = skipped / already exists) */
  changed: boolean;
}

export interface Seeder {
  /** Unique name for logging */
  readonly name: string;

  /**
   * Run the seeder.
   *
   * Implementations MUST be idempotent: calling `run()` multiple times
   * must produce the same result as calling it once.
   *
   * @param dataSource - Initialized TypeORM DataSource
   * @param options    - Optional key-value options (e.g. password from CLI)
   */
  run(
    dataSource: DataSource,
    options?: Record<string, string>,
  ): Promise<SeederResult[]>;
}
