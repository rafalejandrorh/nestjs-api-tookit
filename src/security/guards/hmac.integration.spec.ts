import * as crypto from 'crypto';
import { Body, Controller, INestApplication, Module, Post, Req, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import type { ToolkitOptions } from '../../core/interfaces/toolkit-options.interface';
import { SecurityModule } from '../security.module';
import { HmacGuard } from './hmac.guard';

type HmacRequest = Request & Record<string, unknown>;

function computeSignature(
  method: string,
  uri: string,
  body: unknown,
  timestamp: string,
  secret: string,
): string {
  const bodyHash = crypto.createHash('sha256').update(JSON.stringify(body ?? '')).digest('hex');
  const message = `${method.toUpperCase()}|${uri}|${bodyHash}|${timestamp}`;

  return crypto.createHmac('sha256', secret).update(message).digest('base64');
}

@Controller('api/secure/orders')
@UseGuards(HmacGuard)
class SecureOrdersController {
  @Post()
  create(@Req() req: HmacRequest, @Body() body: unknown) {
    return {
      ok: true,
      body,
      authenticated_hmac: req.authenticated_hmac,
      custom_hmac: req.custom_hmac,
    };
  }
}

@Controller('public/orders')
@UseGuards(HmacGuard)
class PublicOrdersController {
  @Post()
  create() {
    return { ok: true };
  }
}

@Module({
  controllers: [SecureOrdersController, PublicOrdersController],
})
class TestHmacAppModule {
  static register(options: ToolkitOptions) {
    return {
      module: TestHmacAppModule,
      imports: [SecurityModule.forRoot(options)],
    };
  }
}

async function createApp(options: ToolkitOptions): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [TestHmacAppModule.register(options)],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('HmacGuard integration', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('accepts a valid signature on routes under protectedPathPrefix', async () => {
    const secret = 'secret';
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const body = { orderId: 42 };
    const uri = '/api/secure/orders';

    app = await createApp({
      storage: { type: 'memory' },
      hmac: {
        enabled: true,
        secretKey: secret,
        protectedPathPrefix: '/api/secure',
      },
    });

    const response = await request(app.getHttpServer())
      .post(uri)
      .set('x-timestamp', timestamp)
      .set('x-signature', computeSignature('POST', uri, body, timestamp, secret))
      .send(body)
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        body,
        authenticated_hmac: expect.objectContaining({
          timestamp,
          method: 'POST',
          uri,
        }),
      }),
    );
  });

  it('skips validation on routes outside protectedPathPrefix even when the guard is mounted', async () => {
    app = await createApp({
      storage: { type: 'memory' },
      hmac: {
        enabled: true,
        secretKey: 'secret',
        protectedPathPrefix: '/api/secure',
      },
    });

    await request(app.getHttpServer()).post('/public/orders').send({ ok: true }).expect(201, { ok: true });
  });

  it('rejects requests with missing HMAC headers on protected routes', async () => {
    app = await createApp({
      storage: { type: 'memory' },
      hmac: {
        enabled: true,
        secretKey: 'secret',
        protectedPathPrefix: '/api/secure',
      },
    });

    const response = await request(app.getHttpServer()).post('/api/secure/orders').send({ orderId: 42 }).expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 400,
        message: 'X-Timestamp and X-Signature headers are required',
        error: 'Bad Request',
      }),
    );
  });

  it('rejects requests with stale timestamps according to timestampTolerance', async () => {
    app = await createApp({
      storage: { type: 'memory' },
      hmac: {
        enabled: true,
        secretKey: 'secret',
        protectedPathPrefix: '/api/secure',
        timestampTolerance: 10,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/secure/orders')
      .set('x-timestamp', `${Math.floor(Date.now() / 1000) - 11}`)
      .set('x-signature', 'ignored')
      .send({ orderId: 42 })
      .expect(403);

    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 403,
        message: 'Invalid HMAC timestamp',
        error: 'Forbidden',
      }),
    );
  });

  it('stores validation metadata under requestAttributeName when configured', async () => {
    const secret = 'secret';
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const body = { orderId: 42 };
    const uri = '/api/secure/orders';

    app = await createApp({
      storage: { type: 'memory' },
      hmac: {
        enabled: true,
        secretKey: secret,
        protectedPathPrefix: '/api/secure',
        requestAttributeName: 'custom_hmac',
      },
    });

    const response = await request(app.getHttpServer())
      .post(uri)
      .set('x-timestamp', timestamp)
      .set('x-signature', computeSignature('POST', uri, body, timestamp, secret))
      .send(body)
      .expect(201);

    expect(response.body.custom_hmac).toEqual(
      expect.objectContaining({
        timestamp,
        uri,
      }),
    );
  });
});