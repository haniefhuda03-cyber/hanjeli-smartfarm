export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  error?: string;
  fields?: Record<string, string[]>;
  details?: any;
  path?: string;
  timestamp?: string;
}

export interface PaginatedData<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    lastPage: number;
    limit: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'Admin' | 'Guest';
  avatar?: string;
  is2faEnabled?: boolean;
}

export interface AuthSession {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}
