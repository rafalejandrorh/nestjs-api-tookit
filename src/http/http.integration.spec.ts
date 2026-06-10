import { BadRequestException, Body, Controller, Get, INestApplication, Module, Post } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { HttpModule } from './http.module';

@Controller('api/http-test')
class HttpTestController {
  @Post('echo')
  echo(@Body() body: unknown) {
    return { body };
  }

  @Get('bad-request')
  badRequest(): never {
    throw new BadRequestException('invalid query');
  }

  @Get('boom')
  boom(): never {
    throw new Error('unexpected failure');
  }
}

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { ok: true };
  }
}

@Module({
  controllers: [HttpTestController, HealthController],
})
class TestHttpAppModule {
  static register(options: ToolkitOptions) {
    return {
      module: TestHttpAppModule,
      imports: [HttpModule.forRoot(options)],
    };
  }
}

async function createApp(options: ToolkitOptions): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [TestHttpAppModule.register(options)],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('HTTP Toolkit integration', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('rejects non-json content-type and returns JSON error payload', async () => {
    app = await createApp({ storage: { type: 'memory' } });

    const response = await request(app.getHttpServer())
      .post('/api/http-test/echo')
      .set('content-type', 'text/plain')
      .send('plain body')
      .expect(415);

    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 415,
        error: 'UnsupportedMediaTypeException',
        path: '/api/http-test/echo',
      }),
    );
  });

  it('applies default and custom response headers on matched routes', async () => {
    app = await createApp({
      storage: { type: 'memory' },
      http: {
        responseHeaders: {
          headers: {
            'x-api-toolkit': 'enabled',
          },
        },
      },
    });

    const response = await request(app.getHttpServer()).get('/api/http-test/bad-request').expect(400);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-api-toolkit']).toBe('enabled');
  });

  it('serializes HttpException errors using the JSON exception filter', async () => {
    app = await createApp({ storage: { type: 'memory' } });

    const response = await request(app.getHttpServer()).get('/api/http-test/bad-request').expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 400,
        error: 'BadRequestException',
        message: 'invalid query',
        path: '/api/http-test/bad-request',
      }),
    );
  });

  it('includes stack traces when includeStack is enabled', async () => {
    app = await createApp({
      storage: { type: 'memory' },
      http: {
        exception: {
          includeStack: true,
        },
      },
    });

    const response = await request(app.getHttpServer()).get('/api/http-test/boom').expect(500);

    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 500,
        error: 'InternalServerError',
        message: 'unexpected failure',
        path: '/api/http-test/boom',
        stack: expect.any(String),
      }),
    );
  });

  it('respects globalMatch for middlewares on unmatched routes', async () => {
    app = await createApp({
      storage: { type: 'memory' },
      globalMatch: {
        include: ['^/api/'],
      },
    });

    const response = await request(app.getHttpServer())
      .post('/health')
      .set('content-type', 'text/plain')
      .send('ok')
      .expect(404);

    expect(response.headers['x-content-type-options']).toBeUndefined();
    expect(response.headers['x-frame-options']).toBeUndefined();
    expect(response.headers['referrer-policy']).toBeUndefined();
  });
});