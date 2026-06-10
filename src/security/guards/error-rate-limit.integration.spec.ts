import { Controller, Get, INestApplication, Module, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { TOOLKIT_STORAGE_DRIVER } from '../../core/tokens';
import { SecurityModule } from '../security.module';
import { ErrorRateLimitGuard } from './error-rate-limit.guard';

type StorageState = Record<string, string | null>;

function createStorageDriver(state: StorageState) {
  return {
    get: jest.fn(async (key: string) => state[key] ?? null),
    set: jest.fn(async (key: string, value: string) => {
      state[key] = value;
    }),
    increment: jest.fn(),
  };
}

@Controller('api/rate-limit-test')
@UseGuards(ErrorRateLimitGuard)
class RateLimitController {
  @Get()
  get() {
    return { ok: true };
  }
}

@Module({
  controllers: [RateLimitController],
})
class TestRateLimitAppModule {
  static register(options: ToolkitOptions, state: StorageState) {
    return {
      module: TestRateLimitAppModule,
      imports: [SecurityModule.forRoot(options)],
      providers: [
        {
          provide: TOOLKIT_STORAGE_DRIVER,
          useValue: createStorageDriver(state),
        },
      ],
    };
  }
}

async function createApp(options: ToolkitOptions, state: StorageState): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [TestRateLimitAppModule.register(options, state)],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('ErrorRateLimitGuard integration', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('blocks requests when banned_ip_<ip> key is set', async () => {
    app = await createApp(
      {
        storage: { type: 'memory' },
        errorRateLimit: { enabled: true, maxErrors: 3, windowMs: 60000 },
      },
      {
        'banned_ip_::ffff:127.0.0.1': '1',
      },
    );

    const response = await request(app.getHttpServer()).get('/api/rate-limit-test').expect(403);

    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 403,
        message: 'IP banned',
        error: 'Forbidden',
      }),
    );
  });

  it('allows requests while attempts are at or below maxErrors', async () => {
    app = await createApp(
      {
        storage: { type: 'memory' },
        errorRateLimit: { enabled: true, maxErrors: 3, windowMs: 60000 },
      },
      {
        'ip_404_attempts_::ffff:127.0.0.1': '3',
      },
    );

    await request(app.getHttpServer()).get('/api/rate-limit-test').expect(200, { ok: true });
  });

  it('creates ban and blocks when attempts are above maxErrors', async () => {
    const state: StorageState = {
      'ip_404_attempts_::ffff:127.0.0.1': '4',
    };

    app = await createApp(
      {
        storage: { type: 'memory' },
        errorRateLimit: { enabled: true, maxErrors: 3, windowMs: 60000 },
      },
      state,
    );

    await request(app.getHttpServer()).get('/api/rate-limit-test').expect(403);
    expect(state['banned_ip_::ffff:127.0.0.1']).toBe('1');
    expect(state['ip_404_attempts_::ffff:127.0.0.1']).toBe('0');
  });

  it('supports legacy counter key when parity key is missing', async () => {
    app = await createApp(
      {
        storage: { type: 'memory' },
        errorRateLimit: { enabled: true, maxErrors: 3, windowMs: 60000 },
      },
      {
        'rate-limit:errors:::ffff:127.0.0.1': '2',
      },
    );

    await request(app.getHttpServer()).get('/api/rate-limit-test').expect(200, { ok: true });
  });
});