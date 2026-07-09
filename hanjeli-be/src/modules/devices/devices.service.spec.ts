import { DevicesService } from './devices.service.js';

function createService() {
  const devicesRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    remove: jest.fn(),
  };

  return {
    service: new DevicesService(devicesRepository as never),
    devicesRepository,
  };
}

describe('DevicesService', () => {
  it('normalizes device codes on create', async () => {
    const { service, devicesRepository } = createService();
    devicesRepository.findOne.mockResolvedValue(null);

    const device = await service.create('user-1', {
      name: 'Soil Sensor',
      code: '#ws004',
      type: 'sensor',
    });

    expect(device.code).toBe('WS004');
  });

  it('hard-deletes devices (telemetry removed via FK cascade)', async () => {
    const { service, devicesRepository } = createService();
    const device = { id: 'device-1', user_id: 'user-1' };
    devicesRepository.findOne.mockResolvedValue(device);

    const result = await service.remove('user-1', 'device-1');

    expect(devicesRepository.remove).toHaveBeenCalledWith(device);
    expect(result.message).toBe('Device berhasil dihapus');
  });
});
