import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

jest.mock('@nestjs/typeorm', () => {
  const actual = jest.requireActual('@nestjs/typeorm');

  class MockTypeOrmRootModule {}
  class MockTypeOrmFeatureModule {}

  return {
    ...actual,
    TypeOrmModule: {
      ...actual.TypeOrmModule,
      forRoot: jest.fn(() => ({
        module: MockTypeOrmRootModule,
      })),
      forFeature: jest.fn((entities = []) => {
        const providers = entities.map((entity) => ({
          provide: actual.getRepositoryToken(entity),
          useValue: {},
        }));

        return {
          module: MockTypeOrmFeatureModule,
          providers,
          exports: providers,
        };
      }),
    },
  };
});

jest.mock('./../src/modules/auth/auth.module.js', () => ({
  AuthModule: class MockAuthModule {},
}));

jest.mock('./../src/modules/irrigation/irrigation.module.js', () => ({
  IrrigationModule: class MockIrrigationModule {},
}));

jest.mock('./../src/modules/mqtt/mqtt.module.js', () => ({
  MqttModule: class MockMqttModule {},
}));

jest.mock('./../src/modules/websocket/websocket.module.js', () => ({
  WebsocketModule: class MockWebsocketModule {},
}));

jest.mock('./../src/modules/cron/cron.module.js', () => ({
  CronModule: class MockCronModule {},
}));

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'TESTTOTPSECRET'),
  generateURI: jest.fn(() => 'otpauth://totp/Hanjeli:test@example.com'),
  verify: jest.fn(async () => ({ valid: true })),
}));

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = 'test-root-encryption-key';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_CHALLENGE_SECRET = 'test-challenge-secret';
    process.env.TWO_FACTOR_ENCRYPTION_SECRET = 'test-two-factor-secret';
    process.env.AUTH_TOKEN_HASH_SECRET = 'test-auth-token-hash-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
