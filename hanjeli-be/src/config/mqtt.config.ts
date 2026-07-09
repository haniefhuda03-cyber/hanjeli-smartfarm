import { ConfigService } from '@nestjs/config';

export interface MqttRuntimeConfig {
  enabled: boolean;
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId: string;
  connectTimeoutMs: number;
  reconnectInitialMs: number;
  reconnectMaxMs: number;
  irrigationAckTimeoutMs: number;
  topics: {
    sensor: string;
    legacySensor: string;
    deviceStatus: string;
    irrigationCommand: string;
    irrigationAck: string;
    legacyIrrigationAck: string;
  };
}

export function getMqttConfig(config: ConfigService): MqttRuntimeConfig {
  const brokerUrl = config.get<string>('MQTT_BROKER_URL')?.trim();

  return {
    enabled: parseBoolean(
      config.get<string>('MQTT_ENABLED'),
      Boolean(brokerUrl),
    ),
    brokerUrl: brokerUrl || 'mqtt://localhost:1883',
    username: emptyToUndefined(config.get<string>('MQTT_USERNAME')),
    password: emptyToUndefined(config.get<string>('MQTT_PASSWORD')),
    clientId:
      emptyToUndefined(config.get<string>('MQTT_CLIENT_ID')) ??
      `hanjeli-api-${Math.random().toString(16).slice(2)}`,
    connectTimeoutMs: parseNumber(config, 'MQTT_CONNECT_TIMEOUT_MS', 30000),
    reconnectInitialMs: parseNumber(config, 'MQTT_RECONNECT_INITIAL_MS', 1000),
    reconnectMaxMs: parseNumber(config, 'MQTT_RECONNECT_MAX_MS', 30000),
    irrigationAckTimeoutMs: parseNumber(
      config,
      'MQTT_IRRIGATION_ACK_TIMEOUT_MS',
      10000,
    ),
    topics: {
      sensor: 'hanjeli/sensor/+',
      legacySensor: 'hanjeli/+/sensor',
      deviceStatus: 'hanjeli/device/+/status',
      irrigationCommand: 'hanjeli/irrigation/command',
      irrigationAck: 'hanjeli/irrigation/ack',
      legacyIrrigationAck: 'hanjeli/+/irrigation/ack',
    },
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseNumber(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const value = Number(config.get<string>(key) ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
