/**
 * Aturan validasi kata sandi & email — SATU sumber kebenaran untuk seluruh
 * form (register, reset, ganti kata sandi, kelola akun pengguna). Harus SELALU
 * cermin dari validasi backend (auth/users DTO) agar FE & BE tidak drift.
 *
 * Kebijakan kata sandi minimum (wajib): minimal 8 karakter, mengandung huruf
 * besar, dan mengandung angka. Simbol dihitung untuk skor kekuatan tapi tidak
 * diwajibkan.
 */

export type PasswordRequirements = {
  hasMinLength: boolean
  hasUppercase: boolean
  hasNumber: boolean
  hasSymbol: boolean
}

export function evaluatePassword(value: string): {
  requirements: PasswordRequirements
  score: number
} {
  const requirements: PasswordRequirements = {
    hasMinLength: value.length >= 8,
    hasUppercase: /[A-Z]/.test(value),
    hasNumber: /[0-9]/.test(value),
    hasSymbol: /[^A-Za-z0-9]/.test(value),
  }
  const score = Object.values(requirements).filter(Boolean).length
  return { requirements, score }
}

/** Syarat WAJIB (bukan sekadar skor): panjang + huruf besar + angka. */
export function isPasswordStrong(value: string): boolean {
  const { requirements } = evaluatePassword(value)
  return requirements.hasMinLength && requirements.hasUppercase && requirements.hasNumber
}

/**
 * Regex email: format dasar yang ketat (tanpa spasi, tepat satu `@`, ada
 * domain berakhiran TLD). Cukup untuk mencegah salah input & payload aneh;
 * verifikasi keberadaan email dilakukan terpisah (dan sengaja tidak diwajibkan
 * untuk akun yang dikelola admin).
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim()
  return trimmed.length <= 254 && EMAIL_REGEX.test(trimmed)
}
