import {
  AuthenticatedUser,
  UserRole,
} from '../../common/types/authenticated-user.interface.js';

export type AuthTokenType = 'access' | 'refresh' | '2fa_challenge';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: AuthTokenType;
  /**
   * Session epoch copied from users.token_version at issue time. Present on
   * 'access' and 'refresh' tokens; absent on short-lived '2fa_challenge'
   * tokens (which are pre-session). Validated on every protected request and
   * on refresh — a mismatch means the session was revoked server-side.
   */
  token_version?: number;
  /**
   * One-time id of a refresh token (rotation). Its HMAC is stored in
   * auth_tokens (purpose 'refresh') and marked used on first refresh —
   * replaying a rotated refresh token invalidates ALL sessions (reuse =
   * compromise signal). Absent on access/challenge tokens and on legacy
   * refresh tokens minted before rotation was introduced.
   */
  jti?: string;
}

export interface AuthTokensResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: AuthenticatedUser;
}

export interface TwoFactorChallengeResponse {
  requires_2fa: true;
  challenge_token: string;
  expires_in: number;
}

export type LoginResponse = AuthTokensResponse | TwoFactorChallengeResponse;

export interface GoogleAuthProfile {
  google_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}
