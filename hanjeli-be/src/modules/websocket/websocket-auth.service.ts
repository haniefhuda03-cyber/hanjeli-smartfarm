import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface.js';
import { getAuthSecret } from '../auth/auth.config.js';
import { AuthService } from '../auth/auth.service.js';
import { AuthTokenPayload } from '../auth/auth.types.js';

@Injectable()
export class WebsocketAuthService {
  private readonly logger = new Logger(WebsocketAuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async authenticate(client: Socket): Promise<AuthenticatedUser | null> {
    const token = this.extractToken(client);
    if (!token) {
      client.emit('auth:error', { message: 'Token WebSocket tidak tersedia' });
      client.disconnect(true);
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(
        token,
        {
          secret: getAuthSecret(this.config, 'JWT_ACCESS_SECRET'),
        },
      );
      const user = await this.authService.validateAccessTokenPayload(payload);

      client.data.user = user;
      await client.join(this.userRoom(user.id));
      return user;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Rejected WebSocket client ${client.id}: ${message}`);
      client.emit('auth:error', {
        message: 'Sesi tidak valid atau sudah berakhir',
      });
      client.disconnect(true);
      return null;
    }
  }

  getUser(client: Socket): AuthenticatedUser | null {
    return (client.data.user as AuthenticatedUser | undefined) ?? null;
  }

  userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.replace(/^Bearer\s+/i, '').trim();
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.replace(/^Bearer\s+/i, '').trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }

    return null;
  }
}
