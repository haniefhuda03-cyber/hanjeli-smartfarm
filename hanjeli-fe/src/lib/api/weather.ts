import { apiClient } from './client';

export const weatherApi = {
  getCurrent: async () => {
    const res = await apiClient.get('/weather/current') as any;
    return res.data ? res.data : res;
  }
};
