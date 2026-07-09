/**
 * Daftar origin frontend yang diizinkan — dipakai oleh REST (main.ts)
 * dan kedua WebSocket gateway agar kebijakan CORS konsisten
 * (sebelumnya gateway memakai origin '*').
 */
export function buildAllowedOrigins(): string[] {
  const configured = (
    process.env.FRONTEND_ORIGINS ??
    process.env.FRONTEND_URL ??
    ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(
    new Set([
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      ...configured,
    ]),
  );
}
