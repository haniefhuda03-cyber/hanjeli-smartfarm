jest.mock('../websocket/websocket-auth.service.js', () => ({
  WebsocketAuthService: class MockWebsocketAuthService {},
}));

import { MqttSensorHandler } from './mqtt-sensor.handler.js';

const SENT_TS = 1782000000000; /* epoch ms valid (>2020, < now+1h saat test) */

function createHandler(device: Record<string, unknown> | null) {
  const mqttService = {
    getTopicConfig: jest.fn(() => ({
      sensor: 'hanjeli/sensor/+',
      legacySensor: 'hanjeli/+/sensor',
      deviceStatus: 'hanjeli/device/+/status',
    })),
    registerHandler: jest.fn(),
  };
  const telemetryRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const deviceRepository = {
    findOne: jest.fn(async () => device),
    save: jest.fn(async (value) => value),
  };
  const irrigationEngine = {
    processSensorData: jest.fn(),
  };
  const sensorGateway = {
    broadcastTelemetry: jest.fn(),
    broadcastDeviceStatus: jest.fn(),
  };
  const thresholdAlerts = {
    evaluateTelemetry: jest.fn(),
    isPushEnabled: jest.fn(async () => true),
  };

  const handler = new MqttSensorHandler(
    mqttService as never,
    telemetryRepository as never,
    deviceRepository as never,
    irrigationEngine as never,
    sensorGateway as never,
    thresholdAlerts as never,
  );

  return {
    handler,
    telemetryRepository,
    deviceRepository,
    irrigationEngine,
    sensorGateway,
    thresholdAlerts,
  };
}

describe('MqttSensorHandler', () => {
  const device = {
    id: 'device-1',
    user_id: 'user-1',
    code: 'WS004',
    status: 'offline',
    last_seen_at: null,
    warning_message: 'offline',
  };

  it('saves MQTT sensor payload, runs engine, and broadcasts realtime data', async () => {
    const {
      handler,
      telemetryRepository,
      irrigationEngine,
      sensorGateway,
      thresholdAlerts,
    } = createHandler({ ...device });

    await handler.handleSensorData('hanjeli/sensor/#WS004', {
      ts: SENT_TS,
      ph: 6.8,
      moisture: 42,
      nitrogen: 55,
      phosphorus: 25,
      potassium: 40,
      temp: 22.4,
      rain: 1,
    });

    expect(telemetryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        device_id: 'device-1',
        captured_at: new Date(SENT_TS),
        sent_at: new Date(SENT_TS),
        ph_level: 6.8,
        soil_moisture: 42,
        soil_nitrogen: 55,
        soil_phosphorus: 25,
        soil_potassium: 40,
        soil_temperature: 22.4,
        is_raining: true,
      }),
    );
    expect(irrigationEngine.processSensorData).toHaveBeenCalledWith(
      'user-1',
      'device-1',
      expect.objectContaining({ soil_moisture: 42 }),
    );
    /* Key broadcast harus sesuai RealtimeSensorPayload di frontend */
    expect(sensorGateway.broadcastTelemetry).toHaveBeenCalledWith(
      'user-1',
      'WS004',
      expect.objectContaining({
        ph: 6.8,
        soil_moisture: 42,
        nitrogen: 55,
        phosphorus: 25,
        potassium: 40,
        soil_temperature: 22.4,
        is_raining: true,
        sent_at: new Date(SENT_TS).toISOString(),
        ts: SENT_TS,
      }),
    );
    expect(thresholdAlerts.evaluateTelemetry).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ soil_moisture: 42 }),
    );
  });

  it('rejects payloads without a device timestamp (ts wajib dari ESP32)', async () => {
    const { handler, telemetryRepository, sensorGateway } = createHandler({
      ...device,
    });

    await handler.handleSensorData('hanjeli/sensor/#WS004', {
      ph: 6.8,
      moisture: 42,
    });

    expect(telemetryRepository.save).not.toHaveBeenCalled();
    expect(sensorGateway.broadcastTelemetry).not.toHaveBeenCalled();
  });

  it('accepts epoch seconds and normalizes them to the same instant', async () => {
    const { handler, telemetryRepository } = createHandler({ ...device });

    await handler.handleSensorData('hanjeli/sensor/#WS004', {
      ts: Math.floor(SENT_TS / 1000),
      moisture: 42,
    });

    expect(telemetryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        sent_at: new Date(Math.floor(SENT_TS / 1000) * 1000),
      }),
    );
  });

  it('nulls out-of-range values instead of dropping the whole reading', async () => {
    const { handler, telemetryRepository } = createHandler({ ...device });

    await handler.handleSensorData('hanjeli/sensor/#WS004', {
      ts: SENT_TS,
      ph: 22 /* di luar 0-14 */,
      moisture: 42,
    });

    expect(telemetryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ph_level: null,
        soil_moisture: 42,
      }),
    );
  });

  it('updates device heartbeat and broadcasts status', async () => {
    const statusDevice = { ...device, warning_message: null };
    const { handler } = createHandler(statusDevice);

    await handler.handleDeviceStatus('hanjeli/device/#WS004/status', {
      status: 'online',
      ts: SENT_TS,
    });

    expect(statusDevice.status).toBe('online');
  });
});
