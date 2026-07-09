import { apiClient } from './client';

export const irrigationApi = {
  getConfig: async () => {
    const res = await apiClient.get('/irrigation/config') as any;
    return res.data ? res.data : res;
  },
  updateConfig: async (data: any) => {
    const res = await apiClient.put('/irrigation/config', data) as any;
    return res.data ? res.data : res;
  },
  getSchedules: async () => {
    const res = await apiClient.get('/irrigation/schedules') as any;
    const data = res.data ? res.data : res;
    if (!Array.isArray(data)) return [];
    return data.map((s: any) => ({
      id: s.id,
      name: s.name,
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].filter(day => s[day]),
      startTime: s.start_time ? s.start_time.substring(0, 5) : '00:00',
      endTime: s.end_time ? s.end_time.substring(0, 5) : '00:00',
      active: s.active
    }));
  },
  createSchedule: async (data: any) => {
    const payload = {
      name: data.name,
      mon: data.days.includes('mon'),
      tue: data.days.includes('tue'),
      wed: data.days.includes('wed'),
      thu: data.days.includes('thu'),
      fri: data.days.includes('fri'),
      sat: data.days.includes('sat'),
      sun: data.days.includes('sun'),
      start_time: data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime,
      end_time: data.endTime.length === 5 ? `${data.endTime}:00` : data.endTime,
      active: data.active
    };
    const res = await apiClient.post('/irrigation/schedules', payload) as any;
    return res.data ? res.data : res;
  },
  updateSchedule: async ({ id, data }: { id: string; data: any }) => {
    const payload = {
      name: data.name,
      mon: data.days.includes('mon'),
      tue: data.days.includes('tue'),
      wed: data.days.includes('wed'),
      thu: data.days.includes('thu'),
      fri: data.days.includes('fri'),
      sat: data.days.includes('sat'),
      sun: data.days.includes('sun'),
      start_time: data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime,
      end_time: data.endTime.length === 5 ? `${data.endTime}:00` : data.endTime,
      active: data.active
    };
    const res = await apiClient.put(`/irrigation/schedules/${id}`, payload) as any;
    return res.data ? res.data : res;
  },
  deleteSchedule: async (id: string) => {
    const res = await apiClient.delete(`/irrigation/schedules/${id}`) as any;
    return res.data ? res.data : res;
  },
  getActivity: async (params?: { limit?: number }) => {
    const res = await apiClient.get('/irrigation/activity', { params }) as any;
    return res.data ? res.data : res;
  }
};
