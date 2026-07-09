import { ConfigService } from '@nestjs/config';
import { MqttService } from './mqtt.service.js';

function createConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('MqttService', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('routes valid MQTT JSON to the registered topic handler', () => {
    const service = new MqttService(createConfig({ MQTT_ENABLED: 'false' }));
    const handler = jest.fn();

    service.registerHandler('hanjeli/sensor/+', handler);
    (
      service as never as {
        handleMessage: (topic: string, payload: Buffer) => void;
      }
    ).handleMessage('hanjeli/sensor/WS004', Buffer.from('{"ph":6.8}'));

    expect(handler).toHaveBeenCalledWith('hanjeli/sensor/WS004', { ph: 6.8 });
  });

  it('ignores malformed MQTT JSON without calling handlers', () => {
    const service = new MqttService(createConfig({ MQTT_ENABLED: 'false' }));
    const handler = jest.fn();

    service.registerHandler('hanjeli/sensor/+', handler);
    (
      service as never as {
        handleMessage: (topic: string, payload: Buffer) => void;
      }
    ).handleMessage('hanjeli/sensor/WS004', Buffer.from('{bad-json'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('fires irrigation command timeout when ACK is missing', async () => {
    jest.useFakeTimers();
    const service = new MqttService(
      createConfig({
        MQTT_ENABLED: 'false',
        MQTT_IRRIGATION_ACK_TIMEOUT_MS: '10000',
      }),
    );
    const onTimeout = jest.fn();

    const requestId = await service.publishIrrigationCommand(
      { action: 'START', mode: 'manual', speed: 100 },
      { onTimeout },
    );

    expect(requestId).toEqual(expect.any(String));
    jest.advanceTimersByTime(10000);

    expect(onTimeout).toHaveBeenCalledWith(requestId);
  });

  it('clears pending irrigation timeout when ACK is resolved', async () => {
    jest.useFakeTimers();
    const service = new MqttService(
      createConfig({
        MQTT_ENABLED: 'false',
        MQTT_IRRIGATION_ACK_TIMEOUT_MS: '10000',
      }),
    );
    const onTimeout = jest.fn();

    const requestId = await service.publishIrrigationCommand(
      { action: 'STOP', mode: 'manual', speed: 0 },
      { onTimeout },
    );

    expect(service.resolveIrrigationAck(requestId)).toBe(true);
    jest.advanceTimersByTime(10000);

    expect(onTimeout).not.toHaveBeenCalled();
  });
});
