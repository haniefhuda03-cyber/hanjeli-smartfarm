import { apiClient } from './client';

export const preferencesApi = {
  getPreferences: async () => {
    return await apiClient.get('/preferences');
  },
  updatePreferences: async (data: any) => {
    return await apiClient.put('/preferences', data);
  },
  updateUnit: async (data: { parameter_key: string; unit_value: string }) => {
    return await apiClient.put('/preferences/units', data);
  },
  updateSensorThreshold: async (data: { parameter_key: string; min_value: number; max_value: number }) => {
    return await apiClient.put('/preferences/sensor-thresholds', data);
  },
  updateNotificationPref: async (data: { category: string; channel: string; enabled: boolean }) => {
    return await apiClient.put('/preferences/notification-prefs', data);
  }
};
