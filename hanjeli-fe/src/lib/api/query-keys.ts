export const queryKeys = {
  auth: {
    profile: ['auth', 'profile'],
  },
  sensors: {
    overview: ['sensors', 'overview'],
    latest: ['sensors', 'latest'],
    trend: (param: string, range: string) => ['sensors', 'trend', param, range],
    stats: (param: string, range: string) => ['sensors', 'stats', param, range],
    history: (filters: any) => ['sensors', 'history', filters],
    qualityScore: ['sensors', 'quality-score'],
  },
  weather: {
    current: ['weather', 'current'],
  },
  devices: {
    all: ['devices'] as const,
    detail: (id: string) => ['devices', id] as const,
  },
  irrigation: {
    config: ['irrigation', 'config'] as const,
    schedules: ['irrigation', 'schedules'] as const,
    activity: (params: any) => ['irrigation', 'activity', params] as const,
  },
  preferences: {
    all: ['preferences', 'all'],
  },
  users: {
    list: (filters: any) => ['users', 'list', filters],
  },
  notifications: {
    list: ['notifications', 'list'],
  }
};
