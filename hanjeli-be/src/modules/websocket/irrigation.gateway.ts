import {
  Inject,
  Logger,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { buildAllowedOrigins } from '../../config/cors.config.js';
import { UpdateIrrigationConfigDto } from '../irrigation/dto/irrigation.dto.js';
import { IrrigationService } from '../irrigation/irrigation.service.js';
import { MqttService } from '../mqtt/mqtt.service.js';
import { WebsocketAuthService } from './websocket-auth.service.js';

interface SetModePayload {
  mode: 'auto' | 'manual' | 'scheduled' | 'off';
  config?: Omit<UpdateIrrigationConfigDto, 'active_mode'>;
  deviceCode?: string;
}

interface ManualTogglePayload {
  active: boolean;
  channel?: 'water' | 'fertilizer';
  speed?: number;
  deviceCode?: string;
}

@WebSocketGateway({
  cors: {
    origin: buildAllowedOrigins(),
    credentials: true,
  },
  namespace: '/ws',
})
export class IrrigationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(IrrigationGateway.name);

  constructor(
    @Inject(forwardRef(() => MqttService))
    private readonly mqttService: MqttService,
    private readonly irrigationService: IrrigationService,
    private readonly websocketAuth: WebsocketAuthService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const user = await this.websocketAuth.authenticate(client);
    if (!user) return;

    this.logger.log(`Irrigation WS connected: ${client.id} (${user.id})`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Irrigation WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('irrigation:setMode')
  async handleSetMode(
    @MessageBody() payload: SetModePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.requireUser(client);

    // SAFETY: selama mode darurat aktif, semua perubahan mode ditolak di sisi
    // server (bukan hanya disembunyikan di UI). Klien harus 'resume' dulu.
    const current = await this.irrigationService.getConfig(user.id);
    if (current.emergency_stop) {
      this.broadcastIrrigationStatus(user.id, current);
      await this.irrigationService.logActivity(
        user.id,
        'Perubahan mode irigasi ditolak: mode darurat masih aktif.',
        'warning',
      );
      return { success: false, error: 'emergency_active', config: current };
    }

    const config = await this.irrigationService.updateConfig(user.id, {
      ...(payload.config ?? {}),
      active_mode: payload.mode,
      ...(payload.mode === 'off'
        ? {
            manual_water_enabled: false,
            manual_fertilizer_enabled: false,
          }
        : {}),
    });

    if (payload.mode === 'manual') {
      await this.publishManualPumpCommands(user.id, config, payload.deviceCode);
    } else {
      const channels =
        payload.mode === 'off'
          ? (['water', 'fertilizer'] as const)
          : (['water'] as const);

      for (const channel of channels) {
        await this.mqttService.publishIrrigationCommand(
          {
            action: payload.mode === 'off' ? 'STOP' : 'RESUME',
            mode: payload.mode,
            channel,
            speed: payload.mode === 'off' ? 0 : config.manual_speed,
            device_code: payload.deviceCode,
            user_id: user.id,
          },
          {
            onTimeout: async (requestId) => {
              await this.irrigationService.logActivity(
                user.id,
                `ESP32 belum mengirim ACK untuk perubahan mode irigasi (${requestId}).`,
                'warning',
              );
            },
          },
        );
      }
    }

    this.broadcastIrrigationStatus(user.id, config);
    return { success: true, config };
  }

  @SubscribeMessage('irrigation:emergencyStop')
  async handleEmergencyStop(@ConnectedSocket() client: Socket) {
    const user = this.requireUser(client);
    const config = await this.irrigationService.updateConfig(user.id, {
      emergency_stop: true,
    });

    await this.mqttService.publishIrrigationCommand(
      {
        action: 'EMERGENCY_STOP',
        mode: config.active_mode as 'auto' | 'manual' | 'scheduled' | 'off',
        channel: 'water',
        speed: 0,
        user_id: user.id,
      },
      {
        onTimeout: async (requestId) => {
          await this.irrigationService.logActivity(
            user.id,
            `ESP32 belum mengirim ACK untuk emergency stop (${requestId}).`,
            'warning',
          );
        },
      },
    );
    await this.mqttService.publishIrrigationCommand(
      {
        action: 'EMERGENCY_STOP',
        mode: config.active_mode as 'auto' | 'manual' | 'scheduled' | 'off',
        channel: 'fertilizer',
        speed: 0,
        user_id: user.id,
      },
      {
        onTimeout: async (requestId) => {
          await this.irrigationService.logActivity(
            user.id,
            `ESP32 belum mengirim ACK untuk emergency stop pompa pupuk (${requestId}).`,
            'warning',
          );
        },
      },
    );

    this.server
      .to(this.websocketAuth.userRoom(user.id))
      .emit('irrigation:emergency', { active: true, ts: Date.now() });
    this.broadcastIrrigationStatus(user.id, config);

    return { success: true, active: true };
  }

  @SubscribeMessage('irrigation:resume')
  async handleResume(@ConnectedSocket() client: Socket) {
    const user = this.requireUser(client);
    const config = await this.irrigationService.updateConfig(user.id, {
      emergency_stop: false,
    });

    await this.mqttService.publishIrrigationCommand(
      {
        action: 'RESUME',
        mode: config.active_mode as 'auto' | 'manual' | 'scheduled' | 'off',
        channel: 'water',
        speed: config.manual_speed,
        user_id: user.id,
      },
      {
        onTimeout: async (requestId) => {
          await this.irrigationService.logActivity(
            user.id,
            `ESP32 belum mengirim ACK untuk resume irigasi (${requestId}).`,
            'warning',
          );
        },
      },
    );

    this.server
      .to(this.websocketAuth.userRoom(user.id))
      .emit('irrigation:emergency', { active: false, ts: Date.now() });
    this.broadcastIrrigationStatus(user.id, config);

    return { success: true, active: false };
  }

  @SubscribeMessage('irrigation:manualToggle')
  async handleManualToggle(
    @MessageBody() payload: ManualTogglePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.requireUser(client);
    const channel = payload.channel ?? 'water';
    const currentConfig = await this.irrigationService.getConfig(user.id);

    // SAFETY: tolak kontrol manual pompa selama mode darurat aktif.
    if (currentConfig.emergency_stop) {
      this.broadcastIrrigationStatus(user.id, currentConfig);
      await this.irrigationService.logActivity(
        user.id,
        'Kontrol manual pompa ditolak: mode darurat masih aktif.',
        'warning',
      );
      return { success: false, error: 'emergency_active', config: currentConfig };
    }

    const speed = payload.active ? (payload.speed ?? 100) : 0;
    const update =
      channel === 'fertilizer'
        ? {
            active_mode: 'manual' as const,
            manual_water_enabled: payload.active
              ? false
              : currentConfig.manual_water_enabled,
            manual_fertilizer_enabled: payload.active,
            fertilizer_manual_speed: speed,
          }
        : {
            active_mode: 'manual' as const,
            manual_water_enabled: payload.active,
            manual_fertilizer_enabled: payload.active
              ? false
              : currentConfig.manual_fertilizer_enabled,
            manual_speed: speed,
          };
    const config = await this.irrigationService.updateConfig(user.id, {
      ...update,
    });

    if (channel === 'fertilizer' && payload.active) {
      await this.publishSinglePumpCommand(
        user.id,
        payload.deviceCode,
        'water',
        false,
        0,
      );
    }

    if (channel === 'water' && payload.active) {
      await this.publishSinglePumpCommand(
        user.id,
        payload.deviceCode,
        'fertilizer',
        false,
        0,
      );
    }

    await this.mqttService.publishIrrigationCommand(
      {
        action: payload.active ? 'START' : 'STOP',
        mode: 'manual',
        channel,
        speed,
        device_code: payload.deviceCode,
        user_id: user.id,
      },
      {
        onTimeout: async (requestId) => {
          await this.irrigationService.logActivity(
            user.id,
            `ESP32 belum mengirim ACK untuk kontrol manual (${requestId}).`,
            'warning',
          );
        },
      },
    );

    await this.irrigationService.logActivity(
      user.id,
      `Perintah manual pompa ${channel === 'fertilizer' ? 'pupuk' : 'air'} ${payload.active ? 'NYALA' : 'MATI'} dikirim.`,
      'info',
    );
    this.broadcastIrrigationStatus(user.id, config);

    return { success: true, active: payload.active, config };
  }

  broadcastIrrigationAck(
    userId: string,
    deviceCode: string,
    payload: Record<string, unknown>,
  ): void {
    this.server.to(this.websocketAuth.userRoom(userId)).emit('irrigation:ack', {
      device_code: deviceCode,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  private broadcastIrrigationStatus(
    userId: string,
    config: {
      active_mode: string;
      emergency_stop: boolean;
      manual_speed: number;
      fertilizer_manual_speed?: number;
      manual_water_enabled?: boolean;
      manual_fertilizer_enabled?: boolean;
    },
  ): void {
    const waterActive = config.manual_water_enabled ?? false;
    const fertilizerActive = waterActive
      ? false
      : (config.manual_fertilizer_enabled ?? false);

    this.server
      .to(this.websocketAuth.userRoom(userId))
      .emit('irrigation:status', {
        mode: config.active_mode,
        emergency: config.emergency_stop,
        speed: config.manual_speed,
        fertilizer_speed: config.fertilizer_manual_speed ?? 100,
        manual_water_enabled: waterActive,
        manual_fertilizer_enabled: fertilizerActive,
      });
  }

  private async publishManualPumpCommands(
    userId: string,
    config: {
      manual_speed: number;
      fertilizer_manual_speed?: number;
      manual_water_enabled?: boolean;
      manual_fertilizer_enabled?: boolean;
    },
    deviceCode?: string,
  ): Promise<void> {
    const commands = [
      {
        channel: 'water' as const,
        active: config.manual_water_enabled ?? false,
        speed: config.manual_speed,
      },
      {
        channel: 'fertilizer' as const,
        active:
          (config.manual_water_enabled ?? false)
            ? false
            : (config.manual_fertilizer_enabled ?? false),
        speed: config.fertilizer_manual_speed ?? 100,
      },
    ];

    for (const command of commands) {
      await this.publishSinglePumpCommand(
        userId,
        deviceCode,
        command.channel,
        command.active,
        command.speed,
      );
    }
  }

  private async publishSinglePumpCommand(
    userId: string,
    deviceCode: string | undefined,
    channel: 'water' | 'fertilizer',
    active: boolean,
    speed: number,
  ): Promise<void> {
    await this.mqttService.publishIrrigationCommand(
      {
        action: active ? 'START' : 'STOP',
        mode: 'manual',
        channel,
        speed: active ? speed : 0,
        device_code: deviceCode,
        user_id: userId,
      },
      {
        onTimeout: async (requestId) => {
          await this.irrigationService.logActivity(
            userId,
            `ESP32 belum mengirim ACK untuk kontrol manual pompa ${channel} (${requestId}).`,
            'warning',
          );
        },
      },
    );
  }

  private requireUser(client: Socket) {
    const user = this.websocketAuth.getUser(client);
    if (!user) {
      throw new UnauthorizedException('WebSocket belum terautentikasi');
    }

    return user;
  }
}
