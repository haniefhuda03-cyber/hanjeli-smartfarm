import { BadRequestException } from '@nestjs/common';
import { PreferencesService } from './preferences.service.js';

function repositoryMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
}

describe('PreferencesService', () => {
  it('rejects units that are not valid for a parameter', async () => {
    const service = new PreferencesService(
      repositoryMock() as never,
      repositoryMock() as never,
      repositoryMock() as never,
      repositoryMock() as never,
    );

    await expect(
      service.updateUnit('user-1', {
        parameter_key: 'ph',
        unit_value: 'ppm',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
