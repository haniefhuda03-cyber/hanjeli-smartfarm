jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  verify: jest.fn(async () => ({ valid: true })),
}));

import { NotificationsService } from './notifications.service.js';

function createService() {
  const repository = {
    update: jest.fn(async () => ({ affected: 3 })),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({
      id: 'notif-1',
      created_at: new Date('2026-07-01T00:00:00.000Z'),
      ...value,
    })),
  };
  const sensorGateway = {
    broadcastNotification: jest.fn(),
  };

  return {
    service: new NotificationsService(
      repository as never,
      sensorGateway as never,
    ),
    repository,
    sensorGateway,
  };
}

describe('NotificationsService', () => {
  it('marks only the current user notifications as read', async () => {
    const { service, repository } = createService();

    const result = await service.markAllAsRead('user-1');

    expect(repository.update).toHaveBeenCalledWith(
      { user_id: 'user-1', read: false },
      { read: true },
    );
    expect(result.updated).toBe(3);
  });

  it('creates a notification row and broadcasts notification:new', async () => {
    const { service, repository, sensorGateway } = createService();

    const notification = await service.createAndBroadcast('user-1', {
      title: 'Suhu tanah di luar ambang batas',
      description: 'Suhu tanah terbaca 40°C',
      type: 'warning',
      category: 'temperature',
    });

    expect(repository.save).toHaveBeenCalled();
    expect(sensorGateway.broadcastNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        id: 'notif-1',
        title: 'Suhu tanah di luar ambang batas',
        type: 'warning',
        category: 'temperature',
        read: false,
      }),
    );
    expect(notification.user_id).toBe('user-1');
  });
});
