import { BadRequestException } from '@nestjs/common';
import { SensorsService } from './sensors.service.js';

function createService() {
  const manager = {
    query: jest.fn(),
  };
  const telemetryRepository = {
    manager,
    createQueryBuilder: jest.fn(),
  };

  return {
    service: new SensorsService(telemetryRepository as never),
    manager,
    telemetryRepository,
  };
}

function createQueryBuilder() {
  const builder: Record<string, jest.Mock> = {};

  builder.innerJoinAndSelect = jest.fn(() => builder);
  builder.where = jest.fn(() => builder);
  builder.andWhere = jest.fn(() => builder);
  builder.orderBy = jest.fn(() => builder);
  builder.skip = jest.fn(() => builder);
  builder.take = jest.fn(() => builder);
  builder.getManyAndCount = jest.fn(async () => [[{ id: 'row-1' }], 3]);

  return builder;
}

describe('SensorsService', () => {
  it('queries hourly continuous aggregate for day trend data', async () => {
    const { service, manager } = createService();
    manager.query
      .mockResolvedValueOnce([{ id: 'device-1' }])
      .mockResolvedValueOnce(
        Array.from({ length: 24 }, (_, index) => ({
          label: new Date(Date.UTC(2026, 5, 9, index)),
          value: String(6 + index / 100),
        })),
      );

    const result = await service.getTrend('user-1', {
      param: 'ph',
      range: 'day',
    });

    const sql = manager.query.mock.calls[1][0] as string;
    expect(sql).toContain('sensor_hourly_stats');
    expect(sql).toContain('AVG(avg_ph)');
    expect(result).toHaveLength(24);
    expect(result[0]).toEqual({
      label: '2026-06-09T00:00:00.000Z',
      value: 6,
    });
  });

  it('queries daily continuous aggregate for week stats data', async () => {
    const { service, manager } = createService();
    manager.query
      .mockResolvedValueOnce([{ id: 'device-1' }])
      .mockResolvedValueOnce([
        {
          min_value: '40.125',
          max_value: '70.555',
          avg_value: '55.333',
          sample_count: 7,
        },
      ]);

    const result = await service.getStats('user-1', {
      param: 'soil_moisture',
      range: 'week',
    });

    const sql = manager.query.mock.calls[1][0] as string;
    expect(sql).toContain('sensor_daily_stats');
    expect(sql).toContain('MIN(min_moisture)');
    expect(sql).toContain('MAX(max_moisture)');
    expect(result).toEqual({
      param: 'soil_moisture',
      range: 'week',
      min: 40.13,
      max: 70.56,
      avg: 55.33,
      sample_count: 7,
    });
  });

  it('uses non-overlapping pagination windows for history', async () => {
    const { service, telemetryRepository } = createService();
    const builder = createQueryBuilder();
    telemetryRepository.createQueryBuilder.mockReturnValue(builder);

    await service.getHistory('user-1', { page: 2, limit: 20 });

    expect(builder.skip).toHaveBeenCalledWith(20);
    expect(builder.take).toHaveBeenCalledWith(20);
  });

  it('rejects invalid date ranges for history/export queries', async () => {
    const { service } = createService();

    await expect(
      service.getHistory('user-1', {
        page: 1,
        limit: 20,
        from: '2026-06-10T00:00:00.000Z',
        to: '2026-06-09T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('calculates quality score from the latest five soil sensor values', async () => {
    const { service, manager } = createService();
    manager.query.mockResolvedValueOnce([
      {
        id: '1',
        device_id: 'device-1',
        device_id_value: 'device-1',
        device_code: 'WS004',
        device_name: 'Soil Station',
        captured_at: new Date('2026-06-09T10:00:00.000Z'),
        sent_at: new Date('2026-06-09T10:00:00.000Z'),
        ph_level: 6.8,
        soil_moisture: 55,
        soil_nitrogen: 40,
        soil_phosphorus: 30,
        soil_potassium: 35,
        soil_temperature: 25,
        is_raining: false,
      },
    ]);

    await expect(service.getQualityScore('user-1')).resolves.toMatchObject({
      score: 100,
      status: 'Sangat Baik',
      device: {
        id: 'device-1',
        code: 'WS004',
      },
    });
  });
});
