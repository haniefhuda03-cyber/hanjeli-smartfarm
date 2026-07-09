import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { GoogleAuthProfile } from '../auth.types.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID:
        config.get<string>('GOOGLE_CLIENT_ID') ?? 'missing-google-client-id',
      clientSecret:
        config.get<string>('GOOGLE_CLIENT_SECRET') ??
        'missing-google-client-secret',
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') ??
        'http://localhost:3000/api/v3/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): GoogleAuthProfile {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      throw new UnauthorizedException('Akun Google tidak memiliki email');
    }

    return {
      google_id: profile.id,
      email,
      name: profile.displayName || email.split('@')[0],
      avatar_url: profile.photos?.[0]?.value ?? null,
    };
  }
}
