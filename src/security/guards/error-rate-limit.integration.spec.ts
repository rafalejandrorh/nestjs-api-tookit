import { Controller, Get, INestApplication, MiddlewareConsumer, Module, NestModule, RequestMethod, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS, TOOLKIT_STORAGE_DRIVER } from '../../core/tokens';
import { ErrorRateLimitCounterMiddleware } from '../middlewares/error-rate-limit-counter.middleware';
import { ErrorRateLimitGuard } from './error-rate-limit.guard';

type StorageState = Record<string, string | null>;

function createStorageDriver(state: StorageState) {
  return {
    get: jest.fn(async (key: string) => state[key] ?? null),
    set: jest.fn(async (key: string, value: string) => {
      state[key] = value;
    }),
    increment: jest.fn(async (key: string) => {
      const current = Number(state[key] ?? '0');
      const next = Number.isNaN(current) ? 1 : current + 1;
      state[key] = `${next}`;
      return next;
    }),
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
class TestRateLimitAppModule implements NestModule {
  static register(options: ToolkitOptions, state: StorageState) {
    return {
      module: TestRateLimitAppModule,
      providers: [
        ErrorRateLimitGuard,
        ErrorRateLimitCounterMiddleware,
        {
          provide: TOOLKIT_OPTIONS,
          useValue: options,
        },
        {
          provide: TOOLKIT_STORAGE_DRIVER,
          useValue: createStorageDriver(state),
        },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ErrorRateLimitCounterMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
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

  it('increments attempts on 404 at runtime and bans on the next guarded request', async () => {
    const state: StorageState = {};
    app = await createApp(
      {
        storage: { type: 'memory' },
        globalMatch: { include: ['^/api/'] },
        errorRateLimit: { enabled: true, maxErrors: 0, windowMs: 60000 },
      },
      state,
    );

    await request(app.getHttpServer()).get('/api/missing-route').expect(404);
    const attemptKeys = Object.keys(state).filter(key => key.startsWith('ip_404_attempts_'));
    expect(attemptKeys.length).toBeGreaterThan(0);

    const response = await request(app.getHttpServer()).get('/api/rate-limit-test').expect(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 403,
        message: 'IP banned',
        error: 'Forbidden',
      }),
    );
  });
});