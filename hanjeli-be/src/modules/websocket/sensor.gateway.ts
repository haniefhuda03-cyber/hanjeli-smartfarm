import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { buildAllowedOrigins } from '../../config/cors.config.js';
import { WebsocketAuthService } from './websocket-auth.service.js';

@WebSocketGateway({
  cors: {
    origin: buildAllowedOrigins(),
    credentials: true,
  },
  namespace: '/ws',
})
export class SensorGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SensorGateway.name);

  constructor(private readonly websocketAuth: WebsocketAuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    const user = await this.websocketAuth.authenticate(client);
    if (!user) return;

    this.logger.log(`Sensor WS connected: ${client.id} (${user.id})`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Sensor WS disconnected: ${client.id}`);
  }

  broadcastTelemetry(
    userId: string,
    deviceCode: string,
    payload: Record<string, unknown>,
  ): void {
    this.server
      .to(this.websocketAuth.userRoom(userId))
      .emit('sensor:realtime', {
        device_code: deviceCode,
        ...payload,
        ts: payload.ts ?? Date.now(),
      });
  }

  broadcastDeviceStatus(
    userId: string,
    deviceCode: string,
    status: 'online' | 'warning' | 'offline',
    lastSeen: Date,
  ): void {
    this.server.to(this.websocketAuth.userRoom(userId)).emit('device:status', {
      code: deviceCode,
      status,
      lastSeen: lastSeen.toISOString(),
    });
  }

  broadcastNotification(
    userId: string,
    payload: Record<string, unknown>,
  ): void {
    this.server
      .to(this.websocketAuth.userRoom(userId))
      .emit('notification:new', payload);
  }

  /**
   * Putuskan semua socket milik user — dipanggil saat logout atau akun
   * dihapus, agar koneksi realtime tidak tetap hidup setelah sesi berakhir.
   */
  disconnectUser(userId: string): void {
    this.server.in(this.websocketAuth.userRoom(userId)).disconnectSockets(true);
  }
}
