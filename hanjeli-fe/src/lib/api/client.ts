import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  type AxiosRequestConfig,
} from 'axios';
import { ApiError } from './errors';
import { ApiResponse } from './types';
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  storeAuthSession,
  type AuthTokensResponse,
} from '@/lib/auth-session';
import { getApiBaseUrl } from '@/lib/runtime-config';

const http = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

import { classifyRoute } from '@/lib/auth-routes';

function getCurrentRouteClass() {
  if (typeof window === 'undefined') return 'public' as const;
  return classifyRoute(window.location.pathname);
}

/**
 * Menentukan apakah interceptor boleh memulai proses refresh token.
 * Pada halaman guest (login, verify-2fa, recovery, register) user belum
 * punya access/refresh token — jadi refresh pasti gagal. Lebih fatal lagi,
 * kegagalan itu memicu clearAuthSession() yang menghapus challenge_token
 * di sessionStorage, sehingga alur 2FA hancur.
 */
function shouldAttemptRefresh() {
  const routeClass = getCurrentRouteClass();
  // Halaman guest/public/callback/open tidak punya sesi — jangan coba refresh.
  return routeClass === 'protected';
}

function shouldRedirectAfterUnauthorized() {
  const routeClass = getCurrentRouteClass();
  // Hanya redirect ke /login jika sedang di halaman protected (dashboard).
  return routeClass === 'protected';
}

/**
 * Single-flight refresh.
 *
 * Refresh token bersifat SEKALI-PAKAI (rotasi + deteksi reuse di backend).
 * Saat beberapa request 401 bersamaan (umum: dashboard menembak 4-5 query
 * sekaligus ketika access token kedaluwarsa), semuanya harus menunggu SATU
 * panggilan /auth/refresh yang sama — kalau tidak, panggilan kedua memakai
 * token yang sudah dirotasi dan backend menganggapnya pencurian token
 * (seluruh sesi dibunuh).
 */
let refreshInFlight: Promise<AuthTokensResponse> | null = null;

function refreshSession(): Promise<AuthTokensResponse> {
  if (!refreshInFlight) {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return Promise.reject(new Error('Tidak ada refresh token'));
    }

    refreshInFlight = axios
      .post<AuthTokensResponse>(
        `${getApiBaseUrl()}/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: { 'Content-Type': 'application/json' } },
      )
      .then(({ data }) => {
        storeAuthSession(data, { isRefresh: true });
        return data;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

http.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      // KRITIS: Hanya coba refresh jika sedang di halaman protected DAN
      // refresh token tersedia. Pada halaman guest (verify-2fa, recovery,
      // dll.) user belum punya sesi — refresh pasti gagal dan akan
      // menghapus challenge_token yang sedang dipakai untuk alur 2FA.
      if (shouldAttemptRefresh() && getRefreshToken()) {
        try {
          const data = await refreshSession();

          if (originalRequest.headers && data.access_token) {
            originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          }
          return http(originalRequest);
        } catch {
          clearAuthSession();
        }

        if (shouldRedirectAfterUnauthorized()) {
          window.location.href = '/login';
        }
      }
    }

    if (error.response && error.response.data) {
      throw new ApiError(error.response.data);
    }

    throw error;
  },
);

/**
 * Typed facade over the axios instance. Because the response interceptor unwraps
 * to `response.data`, callers receive the payload directly — not an AxiosResponse.
 * This keeps call-site types honest (e.g. `usersApi.getMe()` -> the user object).
 */
type TypedClient = {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  put<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  patch<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
};

export const apiClient = http as unknown as TypedClient;
