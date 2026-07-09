import { apiClient } from './client';

export const usersApi = {
  getMe: async () => {
    return await apiClient.get('/users/me');
  },
  updateProfile: async (data: {
    name?: string;
    email?: string;
    password?: string;
    currentPassword?: string;
    avatar_url?: string;
  }) => {
    return await apiClient.put('/users/me', data);
  },
  sendEmailToken: async (data: { newEmail: string }) => {
    return await apiClient.post('/users/me/email-token', data);
  },
  verifyEmailToken: async (data: { newEmail: string; token: string }) => {
    return await apiClient.post('/users/me/verify-email-token', data);
  },
  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    // The shared axios instance sets a default Content-Type of application/json,
    // which would override the multipart boundary the browser needs to set.
    // Passing `Content-Type: undefined` here forces axios to let the browser
    // generate the correct `multipart/form-data; boundary=...` header — otherwise
    // the backend receives an empty body and rejects with "File gambar diperlukan".
    return await apiClient.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': undefined as unknown as string },
    });
  },
  deleteAccount: async (data: { password?: string; twoFactorToken?: string }) => {
    return await apiClient.delete('/users/me', { data });
  },
  getAll: async (params?: any) => {
    return await apiClient.get('/users', { params });
  },
  create: async (data: any) => {
    return await apiClient.post('/users', data);
  },
  update: async (id: string, data: any) => {
    return await apiClient.put(`/users/${id}`, data);
  },
  delete: async (id: string) => {
    return await apiClient.delete(`/users/${id}`);
  },
  adminDisable2fa: async (id: string) => {
    return await apiClient.post(`/users/${id}/disable-2fa`);
  }
};
