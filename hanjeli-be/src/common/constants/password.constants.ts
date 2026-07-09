/**
 * Kebijakan kata sandi — HARUS cermin dari frontend (`src/lib/password.ts`
 * `isPasswordStrong`) agar validasi FE & BE tidak drift.
 *
 * Wajib: minimal 8 karakter, mengandung minimal satu huruf besar, dan minimal
 * satu angka. Batas atas 72 = batas byte bcrypt (mencegah truncation diam-diam).
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

/** Minimal satu huruf besar (A–Z) dan satu angka (0–9). */
export const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d).+$/;

export const PASSWORD_POLICY_MESSAGE =
  'Kata sandi minimal 8 karakter, mengandung huruf besar, dan angka.';
