jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  verify: jest.fn(async () => ({ valid: true })),
}));

import { IrrigationEngine } from './irrigation.engine.js';

describe('IrrigationEngine', () => {
  it('starts auto irrigation when soil moisture is below the water range', async () => {
    const configRepository = {
      findOne: jest.fn(async () => ({
        user_id: 'user-1',
        active_mode: 'auto',
        emergency_stop: false,
        auto_parameter: 'soil_moisture',
        auto_threshold_value: 30,
        auto_threshold_direction: 'below',
        water_min_threshold: 30,
        water_max_threshold: 80,
        npk_min_threshold: 60,
        npk_max_threshold: 180,
        nitrogen_min_threshold: 20,
        nitrogen_max_threshold: 60,
        phosphorus_min_threshold: 20,
        phosphorus_max_threshold: 60,
        potassium_min_threshold: 20,
        potassium_max_threshold: 60,
        manual_speed: 80,
        fertilizer_manual_speed: 100,
      })),
      manager: {
        query: jest.fn(async () => [{ code: 'WS004' }]),
      },
    };
    const activityRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const mqttService = {
      publishIrrigationCommand: jest.fn(async () => 'request-1'),
    };
    const engine = new IrrigationEngine(
      configRepository as never,
      activityRepository as never,
      mqttService as never,
      { dispatchAlert: jest.fn() } as never,
    );

    await engine.processSensorData('user-1', 'device-1', {
      soil_moisture: 25,
      soil_nitrogen: 40,
      soil_phosphorus: 30,
      soil_potassium: 35,
    } as never);

    expect(mqttService.publishIrrigationCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'START',
        mode: 'auto',
        speed: 80,
        device_code: 'WS004',
      }),
      expect.objectContaining({ onTimeout: expect.any(Function) }),
    );
    expect(activityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        type: 'info',
      }),
    );
  });

  it('stops auto irrigation when soil moisture is above the water range', async () => {
    const configRepository = {
      findOne: jest.fn(async () => ({
        user_id: 'user-1',
        active_mode: 'auto',
        emergency_stop: false,
        water_min_threshold: 30,
        water_max_threshold: 80,
        npk_min_threshold: 60,
        npk_max_threshold: 180,
        nitrogen_min_threshold: 20,
        nitrogen_max_threshold: 60,
        phosphorus_min_threshold: 20,
        phosphorus_max_threshold: 60,
        potassium_min_threshold: 20,
        potassium_max_threshold: 60,
        manual_speed: 80,
        fertilizer_manual_speed: 100,
      })),
      manager: {
        query: jest.fn(async () => [{ code: 'WS004' }]),
      },
    };
    const activityRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const mqttService = {
      publishIrrigationCommand: jest.fn(async () => 'request-1'),
    };
    const engine = new IrrigationEngine(
      configRepository as never,
      activityRepository as never,
      mqttService as never,
      { dispatchAlert: jest.fn() } as never,
    );

    await engine.processSensorData('user-1', 'device-1', {
      soil_moisture: 25,
      soil_nitrogen: 40,
      soil_phosphorus: 30,
      soil_potassium: 35,
    } as never);
    await engine.processSensorData('user-1', 'device-1', {
      soil_moisture: 85,
      soil_nitrogen: 40,
      soil_phosphorus: 30,
      soil_potassium: 35,
    } as never);

    expect(mqttService.publishIrrigationCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'STOP',
        mode: 'auto',
        speed: 0,
        device_code: 'WS004',
      }),
      expect.objectContaining({ onTimeout: expect.any(Function) }),
    );
  });

  it('starts fertilizer pump when one NPK component is below the configured range', async () => {
    const configRepository = {
      findOne: jest.fn(async () => ({
        user_id: 'user-1',
        active_mode: 'auto',
        emergency_stop: false,
        water_min_threshold: 30,
        water_max_threshold: 80,
        npk_min_threshold: 60,
        npk_max_threshold: 180,
        nitrogen_min_threshold: 20,
        nitrogen_max_threshold: 60,
        phosphorus_min_threshold: 20,
        phosphorus_max_threshold: 60,
        potassium_min_threshold: 20,
        potassium_max_threshold: 60,
        manual_speed: 80,
        fertilizer_manual_speed: 100,
      })),
      manager: {
        query: jest.fn(async () => [{ code: 'WS004' }]),
      },
    };
    const activityRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const mqttService = {
      publishIrrigationCommand: jest.fn(async () => 'request-1'),
    };
    const engine = new IrrigationEngine(
      configRepository as never,
      activityRepository as never,
      mqttService as never,
      { dispatchAlert: jest.fn() } as never,
    );

    await engine.processSensorData('user-1', 'device-1', {
      soil_moisture: 50,
      soil_nitrogen: 10,
      soil_phosphorus: 30,
      soil_potassium: 35,
    } as never);

    expect(mqttService.publishIrrigationCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'START',
        channel: 'fertilizer',
        speed: 100,
      }),
      expect.objectContaining({ onTimeout: expect.any(Function) }),
    );
    expect(activityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        type: 'warning',
        description: expect.stringContaining('N=10'),
      }),
    );
  });

  it('prioritizes fertilizer pump and stops water pump when both auto rules request on', async () => {
    const configRepository = {
      findOne: jest.fn(async () => ({
        user_id: 'user-1',
        active_mode: 'auto',
        emergency_stop: false,
        water_min_threshold: 30,
        water_max_threshold: 80,
        npk_min_threshold: 60,
        npk_max_threshold: 180,
        nitrogen_min_threshold: 20,
        nitrogen_max_threshold: 60,
        phosphorus_min_threshold: 20,
        phosphorus_max_threshold: 60,
        potassium_min_threshold: 20,
        potassium_max_threshold: 60,
        manual_speed: 80,
        fertilizer_manual_speed: 100,
      })),
      manager: {
        query: jest.fn(async () => [{ code: 'WS004' }]),
      },
    };
    const activityRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const mqttService = {
      publishIrrigationCommand: jest.fn(async () => 'request-1'),
    };
    const engine = new IrrigationEngine(
      configRepository as never,
      activityRepository as never,
      mqttService as never,
      { dispatchAlert: jest.fn() } as never,
    );

    await engine.processSensorData('user-1', 'device-1', {
      soil_moisture: 25,
      soil_nitrogen: 30,
      soil_phosphorus: 30,
      soil_potassium: 35,
    } as never);
    await engine.processSensorData('user-1', 'device-1', {
      soil_moisture: 25,
      soil_nitrogen: 10,
      soil_phosphorus: 30,
      soil_potassium: 35,
    } as never);

    const commands = (
      mqttService.publishIrrigationCommand.mock.calls as unknown[][]
    ).map((call) => call[0]);
    expect(commands).toEqual([
      expect.objectContaining({
        action: 'START',
        channel: 'water',
        speed: 80,
      }),
      expect.objectContaining({
        action: 'STOP',
        channel: 'water',
        speed: 0,
      }),
      expect.objectContaining({
        action: 'START',
        channel: 'fertilizer',
        speed: 100,
      }),
    ]);
  });

  it('forces an emergency stop command even when pump state is already off', async () => {
    const configRepository = {
      findOne: jest.fn(async () => ({
        user_id: 'user-1',
        active_mode: 'auto',
        emergency_stop: true,
        manual_speed: 100,
      })),
      manager: {
        query: jest.fn(async () => [{ code: 'WS004' }]),
      },
    };
    const activityRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const mqttService = {
      publishIrrigationCommand: jest.fn(async () => 'request-1'),
    };
    const engine = new IrrigationEngine(
      configRepository as never,
      activityRepository as never,
      mqttService as never,
      { dispatchAlert: jest.fn() } as never,
    );

    await engine.processSensorData('user-1', 'device-1', {} as never);

    expect(mqttService.publishIrrigationCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMERGENCY_STOP',
        speed: 0,
      }),
      expect.any(Object),
    );
  });
});
