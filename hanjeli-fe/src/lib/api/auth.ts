import { apiClient } from './client';
import { AuthSession } from './types';

export type LoginResponse = AuthSession | {
  requires_2fa: true;
  challenge_token: string;
};

export const authApi = {
  login: async (data: any) => {
    // apiClient.post returns the response body directly thanks to interceptor
    const res = await apiClient.post<{ data: LoginResponse }>('/auth/login', data) as any;
    // Handle both wrapped response and direct response from old mock server
    return res.data ? res.data : res;
  },
  register: async (data: any) => {
    const res = await apiClient.post('/auth/register', data) as any;
    return res.data ? res.data : res;
  },
  forgotPassword: async (data: { email: string }) => {
    const res = await apiClient.post('/auth/forgot-password', data) as any;
    return res.data ? res.data : res;
  },
  resetPassword: async (data: any) => {
    const res = await apiClient.post('/auth/reset-password', data) as any;
    return res.data ? res.data : res;
  },
  verify2Fa: async (data: any) => {
    const res = await apiClient.post('/auth/verify-2fa', data) as any;
    return res.data ? res.data : res;
  },
  verifyEmail: async (data: { token: string }) => {
    const res = await apiClient.post('/auth/verify-email', data) as any;
    return res.data ? res.data : res;
  },
  resendVerification: async (data: { email: string }) => {
    const res = await apiClient.post('/auth/resend-verification', data) as any;
    return res.data ? res.data : res;
  },
  setup2Fa: async () => {
    const res = await apiClient.post('/auth/2fa/setup') as any;
    return res.data ? res.data : res;
  },
  enable2Fa: async (data: { token: string }) => {
    const res = await apiClient.post('/auth/2fa/enable', data) as any;
    return res.data ? res.data : res;
  },
  disable2Fa: async () => {
    const res = await apiClient.delete('/auth/2fa') as any;
    return res.data ? res.data : res;
  },
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      // ignore
    }
    if (typeof window !== 'undefined') {
      import('@/lib/auth-session').then(({ clearAuthSession }) => {
        clearAuthSession();
        window.location.href = '/login';
      });
    }
  },
  getProfile: async () => {
    const res = await apiClient.get('/users/me') as any;
    return res.data ? res.data : res;
  }
};
