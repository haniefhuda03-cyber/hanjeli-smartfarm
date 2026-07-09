import {
  BadRequestException,
  Logger,
  RequestMethod,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { buildAllowedOrigins } from './config/cors.config.js';
import { dataSourceOptions } from './config/data-source.js';
import { ensureAdminUser } from './database/admin-bootstrap.js';
import { ensureDatabaseExists } from './database/helpers/db-check.js';
import { initializeSchema } from './database/schema-init.js';

/**
 * Database + skema dibuat otomatis jika belum ada, SEBELUM modul Nest
 * (MQTT/WS/cron) aktif — tidak ada folder migrations yang perlu dijalankan.
 */
async function prepareDatabase(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const maxAttempts = 30;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await ensureDatabaseExists({
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USERNAME ?? 'hanjeli_admin',
        password: process.env.DB_PASSWORD ?? 'hanjeli_password_super_aman',
        database: process.env.DB_NAME ?? 'hanjeli_smartfarm_db',
      });

      const dataSource = new DataSource(dataSourceOptions);
      await dataSource.initialize();
      try {
        await initializeSchema(dataSource);

        /* Akun admin di-seed saat startup HANYA jika SEED_ADMIN_EMAIL
           tersedia di env (untuk Docker/CI). Untuk setup manual pertama
           kali, gunakan: npm run db:setup */
        try {
          const adminEmail = await ensureAdminUser(dataSource);
          if (adminEmail) {
            logger.log(`Akun admin siap: ${adminEmail}`);
          } else {
            logger.log(
              'Admin seeding dilewati (SEED_ADMIN_EMAIL tidak di-set). ' +
              'Gunakan CLI: npm run db:setup',
            );
          }
        } catch (seedError) {
          const seedMessage =
            seedError instanceof Error ? seedError.message : String(seedError);
          logger.warn(`Seeding admin dilewati: ${seedMessage}`);
        }
      } finally {
        await dataSource.destroy();
      }
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === maxAttempts) {
        throw new Error(`Gagal menyiapkan database: ${message}`);
      }
      logger.warn(
        `Database belum siap (percobaan ${attempt}/${maxAttempts}): ${message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

async function bootstrap() {
  await prepareDatabase();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve uploaded files (e.g. avatars) as static assets at /uploads/*.
  // Registered at the Express level, so it is NOT under the api/v3 global prefix.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.setGlobalPrefix('api/v3', {
    exclude: [{ path: '', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => createValidationException(errors),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: buildAllowedOrigins(),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Hanjeli Smart Farm API')
    .setDescription('Dokumentasi REST API Hanjeli Smart Farm backend v3')
    .setVersion('3.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v3/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}

function createValidationException(
  errors: ValidationError[],
): BadRequestException {
  const fields = flattenValidationErrors(errors);

  return new BadRequestException({
    message: 'Input tidak valid',
    error: 'Bad Request',
    fields,
    details: fields.map(
      (field) => `${field.field}: ${field.messages.join(', ')}`,
    ),
  });
}

function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): Array<{ field: string; messages: string[] }> {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const current =
      error.constraints && Object.keys(error.constraints).length > 0
        ? [
            {
              field,
              messages: Object.values(error.constraints),
            },
          ]
        : [];

    return [
      ...current,
      ...flattenValidationErrors(error.children ?? [], field),
    ];
  });
}

bootstrap();
