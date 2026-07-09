jest.mock('./websocket-auth.service.js', () => ({
  WebsocketAuthService: class MockWebsocketAuthService {},
}));

import { IrrigationGateway } from './irrigation.gateway.js';

function createGateway() {
  const mqttService = {
    publishIrrigationCommand: jest.fn(async () => 'request-1'),
  };
  const irrigationService = {
    getConfig: jest.fn(async () => ({
      active_mode: 'off',
      emergency_stop: false,
      manual_speed: 100,
      manual_water_enabled: false,
      manual_fertilizer_enabled: false,
    })),
    updateConfig: jest.fn(async () => ({
      active_mode: 'auto',
      emergency_stop: true,
      manual_speed: 100,
      manual_water_enabled: true,
      manual_fertilizer_enabled: false,
    })),
    logActivity: jest.fn(),
  };
  const websocketAuth = {
    getUser: jest.fn(() => ({
      id: 'user-1',
      email: 'user@example.com',
      role: 'Guest',
    })),
    userRoom: jest.fn((id: string) => `user:${id}`),
  };
  const gateway = new IrrigationGateway(
    mqttService as never,
    irrigationService as never,
    websocketAuth as never,
  );
  const room = {
    emit: jest.fn(),
  };
  gateway.server = {
    to: jest.fn(() => room),
  } as never;

  return {
    gateway,
    mqttService,
    irrigationService,
    websocketAuth,
    room,
  };
}

describe('IrrigationGateway', () => {
  it('handles emergency stop using authenticated socket user', async () => {
    const { gateway, mqttService, irrigationService, room } = createGateway();

    const result = await gateway.handleEmergencyStop({
      data: {},
    } as never);

    expect(irrigationService.updateConfig).toHaveBeenCalledWith('user-1', {
      emergency_stop: true,
    });
    expect(mqttService.publishIrrigationCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMERGENCY_STOP',
        speed: 0,
        user_id: 'user-1',
      }),
      expect.objectContaining({ onTimeout: expect.any(Function) }),
    );
    expect(room.emit).toHaveBeenCalledWith('irrigation:emergency', {
      active: true,
      ts: expect.any(Number),
    });
    expect(result).toEqual({ success: true, active: true });
  });

  it('handles manual toggle and updates config before publishing MQTT command', async () => {
    const { gateway, mqttService, irrigationService } = createGateway();

    await gateway.handleManualToggle(
      { active: true, speed: 75, deviceCode: 'WS004' },
      { data: {} } as never,
    );

    expect(irrigationService.updateConfig).toHaveBeenCalledWith('user-1', {
      active_mode: 'manual',
      manual_water_enabled: true,
      manual_fertilizer_enabled: false,
      manual_speed: 75,
    });
    const commands = (
      mqttService.publishIrrigationCommand.mock.calls as unknown[][]
    ).map((call) => call[0]);
    expect(commands).toEqual([
      expect.objectContaining({
        action: 'STOP',
        mode: 'manual',
        channel: 'fertilizer',
        speed: 0,
        device_code: 'WS004',
      }),
      expect.objectContaining({
        action: 'START',
        mode: 'manual',
        channel: 'water',
        speed: 75,
        device_code: 'WS004',
      }),
    ]);
  });
});
