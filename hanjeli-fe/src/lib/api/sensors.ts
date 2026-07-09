import { apiClient } from './client';

export const sensorsApi = {
  getOverview: async () => {
    const res = await apiClient.get('/sensors/overview') as any;
    return res.data ? res.data : res;
  },
  getQualityScore: async () => {
    const res = await apiClient.get('/sensors/quality-score') as any;
    return res.data ? res.data : res;
  },
  getHistory: async (params?: { limit?: number; page?: number; from?: string; to?: string }) => {
    const res = await apiClient.get('/sensors/history', { params }) as any;
    return res.data ? res.data : res;
  },
  getTrend: async (param: string, range: string) => {
    const res = await apiClient.get(`/sensors/trend`, { params: { param, range } }) as any;
    return res.data ? res.data : res;
  },
  getStats: async (param: string, range: string) => {
    const res = await apiClient.get(`/sensors/stats`, { params: { param, range } }) as any;
    return res.data ? res.data : res;
  }
};
