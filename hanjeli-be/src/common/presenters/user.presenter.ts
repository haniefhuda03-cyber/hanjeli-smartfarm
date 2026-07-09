import {
  AuthenticatedUser,
  UserRole,
} from '../types/authenticated-user.interface.js';
import { User } from '../../entities/user.entity.js';

export interface PublicUser extends AuthenticatedUser {
  created_at: Date;
  updated_at: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    avatar_url: user.avatar_url,
    email_verified: user.email_verified,
    two_factor_enabled: user.two_factor_enabled,
    google_id: user.google_id,
    password_updated_at: user.password_updated_at ? user.password_updated_at.toISOString() : null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}
