import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service.js';
import { getAuthSecret } from '../auth.config.js';
import { AuthTokenPayload } from '../auth.types.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getAuthSecret(config, 'JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AuthTokenPayload) {
    return this.authService.validateAccessTokenPayload(payload);
  }
}
