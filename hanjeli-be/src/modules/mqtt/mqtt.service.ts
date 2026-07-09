import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import * as mqtt from 'mqtt';
import { getMqttConfig, MqttRuntimeConfig } from '../../config/mqtt.config.js';

type MqttPayload = Record<string, unknown>;
type MqttHandler = (
  topic: string,
  payload: MqttPayload,
) => Promise<void> | void;

export interface IrrigationCommandPayload {
  action: 'START' | 'STOP' | 'EMERGENCY_STOP' | 'RESUME';
  mode?: 'auto' | 'manual' | 'scheduled' | 'off';
  channel?: 'water' | 'fertilizer';
  speed?: number;
  device_code?: string;
  user_id?: string;
}

interface PendingCommand {
  timer: NodeJS.Timeout;
  onTimeout?: (requestId: string) => Promise<void> | void;
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private readonly runtimeConfig: MqttRuntimeConfig;
  private readonly handlers = new Map<string, MqttHandler>();
  private readonly pendingCommands = new Map<string, PendingCommand>();
  private client: mqtt.MqttClient | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private closing = false;

  constructor(configService: ConfigService) {
    this.runtimeConfig = getMqttConfig(configService);
  }

  onModuleInit(): void {
    if (!this.runtimeConfig.enabled) {
      this.logger.log('MQTT disabled. Set MQTT_ENABLED=true to connect.');
      return;
    }

    this.connect();
  }

  onModuleDestroy(): void {
    this.closing = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    for (const pending of this.pendingCommands.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingCommands.clear();

    if (this.client) {
      this.client.end(true);
      this.client.removeAllListeners();
    }
  }

  registerHandler(topicPattern: string, handler: MqttHandler): void {
    this.handlers.set(topicPattern, handler);

    if (this.client?.connected) {
      this.subscribe(topicPattern);
    }
  }

  async publish(topic: string, payload: MqttPayload): Promise<void> {
    if (!this.client?.connected) {
      this.logger.warn(
        `Cannot publish to ${topic}; MQTT client is not connected`,
      );
      return;
    }

    await new Promise<void>((resolve) => {
      this.client?.publish(
        topic,
        JSON.stringify(payload),
        { qos: 1 },
        (error) => {
          if (error) {
            this.logger.error(
              `Failed to publish to ${topic}: ${error.message}`,
            );
          }
          resolve();
        },
      );
    });
  }

  async publishIrrigationCommand(
    command: IrrigationCommandPayload,
    options: {
      onTimeout?: (requestId: string) => Promise<void> | void;
      timeoutMs?: number;
    } = {},
  ): Promise<string> {
    const requestId = randomUUID();
    const payload = {
      ...command,
      ts: Date.now(),
      request_id: requestId,
    };

    const timeoutMs =
      options.timeoutMs ?? this.runtimeConfig.irrigationAckTimeoutMs;
    const timer = setTimeout(() => {
      this.pendingCommands.delete(requestId);
      this.logger.warn(
        `Irrigation command ${requestId} did not receive ACK within ${timeoutMs}ms`,
      );
      void options.onTimeout?.(requestId);
    }, timeoutMs);

    this.pendingCommands.set(requestId, {
      timer,
      onTimeout: options.onTimeout,
    });

    await this.publish(this.runtimeConfig.topics.irrigationCommand, payload);
    return requestId;
  }

  resolveIrrigationAck(requestId: string | undefined): boolean {
    if (!requestId) return false;

    const pending = this.pendingCommands.get(requestId);
    if (!pending) return false;

    clearTimeout(pending.timer);
    this.pendingCommands.delete(requestId);
    return true;
  }

  getTopicConfig() {
    return this.runtimeConfig.topics;
  }

  private connect(): void {
    if (this.closing || this.client) return;

    const { brokerUrl, clientId, username, password, connectTimeoutMs } =
      this.runtimeConfig;

    this.logger.log(`Connecting to MQTT broker: ${brokerUrl}`);
    this.client = mqtt.connect(brokerUrl, {
      clientId,
      username,
      password,
      clean: true,
      reconnectPeriod: 0,
      connectTimeout: connectTimeoutMs,
    });

    this.client.on('connect', () => {
      this.reconnectAttempts = 0;
      this.logger.log('Connected to MQTT broker');
      for (const topicPattern of this.handlers.keys()) {
        this.subscribe(topicPattern);
      }
    });

    this.client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload);
    });

    this.client.on('error', (error) => {
      this.logger.error(`MQTT client error: ${error.message}`);
    });

    this.client.on('close', () => {
      this.client?.removeAllListeners();
      this.client = null;
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.closing || !this.runtimeConfig.enabled || this.reconnectTimer) {
      return;
    }

    const delay = Math.min(
      this.runtimeConfig.reconnectInitialMs * 2 ** this.reconnectAttempts,
      this.runtimeConfig.reconnectMaxMs,
    );
    this.reconnectAttempts += 1;

    this.logger.warn(`MQTT reconnect scheduled in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private subscribe(topicPattern: string): void {
    this.client?.subscribe(topicPattern, { qos: 1 }, (error) => {
      if (error) {
        this.logger.error(
          `Failed to subscribe to ${topicPattern}: ${error.message}`,
        );
        return;
      }

      this.logger.log(`Subscribed to MQTT topic ${topicPattern}`);
    });
  }

  private handleMessage(topic: string, payload: Buffer): void {
    const parsed = this.parsePayload(topic, payload);
    if (!parsed) return;

    for (const [pattern, handler] of this.handlers.entries()) {
      if (!this.topicMatches(pattern, topic)) continue;

      void Promise.resolve(handler(topic, parsed)).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`MQTT handler failed for ${topic}: ${message}`);
      });
    }
  }

  private parsePayload(topic: string, payload: Buffer): MqttPayload | null {
    try {
      const parsed = JSON.parse(payload.toString());
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      this.logger.error(`Malformed MQTT JSON ignored on topic ${topic}`);
      return null;
    }
  }

  private topicMatches(pattern: string, topic: string): boolean {
    const escaped = pattern
      .split('/')
      .map((part) => {
        if (part === '+') return '[^/]+';
        if (part === '#') return '.+';
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');

    return new RegExp(`^${escaped}$`).test(topic);
  }
}
