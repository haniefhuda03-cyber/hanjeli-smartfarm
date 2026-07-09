import { BadRequestException } from '@nestjs/common';
import { IrrigationService } from './irrigation.service.js';

function repositoryMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    softRemove: jest.fn(),
  };
}

function createService() {
  const configRepository = repositoryMock();
  const scheduleRepository = repositoryMock();
  const activityRepository = repositoryMock();

  return {
    service: new IrrigationService(
      configRepository as never,
      scheduleRepository as never,
      activityRepository as never,
    ),
    configRepository,
    scheduleRepository,
    activityRepository,
  };
}

describe('IrrigationService', () => {
  it('creates default config when user config is missing', async () => {
    const { service, configRepository } = createService();
    configRepository.findOne.mockResolvedValue(null);

    const config = await service.getConfig('user-1');

    expect(configRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        active_mode: 'off',
        emergency_stop: false,
        auto_parameter: 'soil_moisture',
        manual_water_enabled: false,
      }),
    );
    expect(config.user_id).toBe('user-1');
  });

  it('keeps emergency stop logging idempotent when state does not change', async () => {
    const { service, configRepository, activityRepository } = createService();
    configRepository.findOne.mockResolvedValue({
      user_id: 'user-1',
      active_mode: 'auto',
      emergency_stop: true,
      manual_speed: 100,
    });

    await service.updateConfig('user-1', { emergency_stop: true });

    expect(activityRepository.save).not.toHaveBeenCalled();
  });

  it('rejects invalid automatic threshold ranges', async () => {
    const { service, configRepository } = createService();
    configRepository.findOne.mockResolvedValue({
      user_id: 'user-1',
      active_mode: 'auto',
      emergency_stop: false,
      manual_speed: 100,
      water_min_threshold: 80,
      water_max_threshold: 90,
      npk_min_threshold: 60,
      npk_max_threshold: 180,
    });

    await expect(
      service.updateConfig('user-1', {
        water_min_threshold: 90,
        water_max_threshold: 80,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects manual water and fertilizer pumps active at the same time', async () => {
    const { service, configRepository } = createService();
    configRepository.findOne.mockResolvedValue({
      user_id: 'user-1',
      active_mode: 'manual',
      emergency_stop: false,
      manual_speed: 100,
      water_min_threshold: 30,
      water_max_threshold: 80,
      nitrogen_min_threshold: 20,
      nitrogen_max_threshold: 60,
      phosphorus_min_threshold: 20,
      phosphorus_max_threshold: 60,
      potassium_min_threshold: 20,
      potassium_max_threshold: 60,
      manual_water_enabled: false,
      manual_fertilizer_enabled: false,
    });

    await expect(
      service.updateConfig('user-1', {
        manual_water_enabled: true,
        manual_fertilizer_enabled: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects schedules with no active day', async () => {
    const { service } = createService();

    await expect(
      service.createSchedule('user-1', {
        name: 'Morning',
        mon: false,
        tue: false,
        wed: false,
        thu: false,
        fri: false,
        sat: false,
        sun: false,
        start_time: '06:00:00',
        end_time: '07:00:00',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns paginated activity logs with common meta shape', async () => {
    const { service, activityRepository } = createService();
    activityRepository.findAndCount.mockResolvedValue([[{ id: '1' }], 21]);

    const result = await service.getActivityLogs('user-1', {
      page: 2,
      limit: 10,
    });

    expect(activityRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'user-1' },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      total_pages: 3,
    });
  });
});
