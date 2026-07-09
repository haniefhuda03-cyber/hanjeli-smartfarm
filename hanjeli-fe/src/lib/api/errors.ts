import { ApiResponse } from './types';

export class ApiError extends Error {
  public statusCode: number;
  public fields?: Record<string, string[]>;
  public details?: any;

  constructor(response: ApiResponse) {
    const message = Array.isArray(response.message)
      ? String(response.message[0] ?? 'Terjadi kesalahan')
      : typeof response.message === 'string'
        ? response.message
        : 'Terjadi kesalahan pada server';

    super(message);
    this.name = 'ApiError';
    this.statusCode = response.statusCode || 500;
    this.fields = response.fields;
    this.details = response.details;
  }
}

/**
 * Extract a user-friendly error message from any caught error.
 * Handles ApiError, standard Error, AxiosError, and raw string responses.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
