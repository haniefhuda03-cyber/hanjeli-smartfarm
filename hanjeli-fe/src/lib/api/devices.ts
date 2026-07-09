import { apiClient } from './client';

export const devicesApi = {
  getAll: async () => {
    const res = await apiClient.get('/devices') as any;
    return res.data ? res.data : res;
  },
  create: async (data: any) => {
    const res = await apiClient.post('/devices', data) as any;
    return res.data ? res.data : res;
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/devices/${id}`) as any;
    return res.data ? res.data : res;
  }
};
