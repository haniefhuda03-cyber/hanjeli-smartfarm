export type UserRole = 'Admin' | 'Guest';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  email_verified: boolean;
  two_factor_enabled: boolean;
  google_id: string | null;
  password_updated_at: string | null;
}
