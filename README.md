# NestJS API Toolkit

Toolkit modular para APIs en NestJS con enfoque en:

- seguridad por HMAC y rate limiting de errores,
- auditoría HTTP (SQL con TypeORM y NoSQL con Mongoose),
- storage abstraído (Redis/Memory),
- OAuth token endpoint (`client_credentials` y `password`).

## Instalación

```bash
yarn install
```

## Uso Básico

Importa el módulo en tu app host:

```ts
import { Module } from '@nestjs/common';
import { ApiToolkitModule } from '@rafalejandrorh/nestjs-api-toolkit';

@Module({
  imports: [
    ApiToolkitModule.forRoot({
      storage: { type: 'memory' },
    }),
  ],
})
export class AppModule {}
```

## Configuración SQL (TypeORM)

```ts
ApiToolkitModule.forRoot({
  storage: { type: 'memory' },
  audit: {
    enabled: true,
    repository: 'sql',
    redactFields: ['ssn', 'creditCard'],
    config: {
      connection: process.env.DATABASE_URL,
      sqlType: 'postgres',
      synchronize: false,
    },
  },
});
```

Notas:

- `sqlType` soporta: `postgres`, `mysql`, `mariadb`, `sqlite`, `mssql`.
- `synchronize` debe mantenerse en `false` en producción.

## Configuración NoSQL (Mongoose)

```ts
ApiToolkitModule.forRoot({
  storage: { type: 'memory' },
  audit: {
    enabled: true,
    repository: 'nosql',
    config: {
      connection: process.env.MONGODB_URI,
      collection: 'audit_logs',
    },
  },
});
```

## Configuración OAuth

El toolkit expone `POST /oauth/token` con soporte de:

- `grant_type=client_credentials`
- `grant_type=password`

Configuración:

```ts
ApiToolkitModule.forRoot({
  storage: { type: 'memory' },
  oauth: {
    enabled: true,
    jwtSecret: process.env.JWT_SECRET,
    jwtIssuer: 'my-api',
    jwtAlgorithm: 'HS256',
    accessTokenExpiresIn: '1h',
    clients: [
      {
        clientId: 'my-client',
        clientSecret: 'my-client-secret',
        scopes: ['read', 'write'],
        users: [
          { username: 'alice', password: 'alice-password' },
        ],
      },
    ],
  },
});
```

Ejemplo `client_credentials`:

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H 'Content-Type: application/json' \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "my-client",
    "client_secret": "my-client-secret",
    "scope": "read"
  }'
```

Ejemplo `password`:

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H 'Content-Type: application/json' \
  -d '{
    "grant_type": "password",
    "client_id": "my-client",
    "client_secret": "my-client-secret",
    "username": "alice",
    "password": "alice-password",
    "scope": "read write"
  }'
```

## Configuración HTTP Transversal

El toolkit puede aplicar políticas HTTP comunes sobre rutas que cumplan `globalMatch`:

- validación de `Content-Type: application/json` para métodos configurables,
- headers de respuesta de seguridad,
- serialización JSON uniforme de excepciones HTTP y errores internos.

Configuración ejemplo:

```ts
ApiToolkitModule.forRoot({
  globalMatch: {
    include: ['^/api/', '^/oauth/'],
    exclude: ['^/api/health'],
  },
  storage: { type: 'memory' },
  http: {
    contentType: {
      enabled: true,
      enforceForMethods: ['POST', 'PUT', 'PATCH'],
    },
    responseHeaders: {
      enabled: true,
      headers: {
        'x-api-toolkit': 'enabled',
      },
    },
    exception: {
      enabled: true,
      includeStack: false,
    },
  },
});
```

Notas:

- `http.exception.includeStack` debería quedar en `false` en producción.
- Si `http.exception.enabled` es `false`, Nest usa su manejador de excepciones por defecto.
- Si una ruta no coincide con `globalMatch`, este bloque HTTP no se aplica.

## Configuración HMAC

El guard HMAC se exporta desde el toolkit, pero la app host decide dónde aplicarlo.

Configuración ejemplo:

```ts
ApiToolkitModule.forRoot({
  globalMatch: {
    include: ['^/api/secure'],
  },
  storage: { type: 'memory' },
  hmac: {
    enabled: true,
    secretKey: process.env.HMAC_SECRET ?? 'change-me',
    protectedPathPrefix: '/api/secure',
    timestampTolerance: 100,
    requestAttributeName: 'authenticated_hmac',
  },
});
```

Aplicación por controlador o handler:

```ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { HmacGuard } from '@rafalejandrorh/nestjs-api-toolkit';

@Controller('api/secure/orders')
@UseGuards(HmacGuard)
export class OrdersController {
  @Post()
  create(@Body() body: unknown) {
    return { ok: true, body };
  }
}
```

Firma esperada por el guard actual:

```ts
import * as crypto from 'crypto';

const body = { orderId: 42 };
const timestamp = `${Math.floor(Date.now() / 1000)}`;
const bodyHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
const message = `POST|/api/secure/orders|${bodyHash}|${timestamp}`;
const signature = crypto.createHmac('sha256', process.env.HMAC_SECRET ?? 'change-me').update(message).digest('base64');
```

El cliente debe enviar:

- `x-timestamp`: epoch en segundos.
- `x-signature`: firma Base64 del mensaje `METHOD|URI|SHA256(body)|timestamp`.

Notas:

- Si `protectedPathPrefix` está definido, el guard solo se aplica a rutas que empiecen por ese prefijo.
- `globalMatch` puede seguir acotando aún más las rutas protegidas si también está configurado.
- El guard usa `rawBody` si está disponible; si no, cae en `JSON.stringify(body)`.
- Si el timestamp cae fuera de `timestampTolerance`, la request se rechaza.
- El guard deja metadatos de validación en `request[requestAttributeName]`.
- A diferencia del bundle Symfony, esta versión Nest valida contra un `secretKey` configurado y no resuelve todavía un secreto distinto por OAuth client autenticado.

## Configuración Error Rate Limit

El guard de rate limit también se exporta para que la app host decida si lo aplica a nivel global, de controlador o de ruta.

Configuración ejemplo:

```ts
ApiToolkitModule.forRoot({
  globalMatch: {
    include: ['^/api/'],
  },
  storage: { type: 'redis', config: { host: '127.0.0.1', port: 6379 } },
  errorRateLimit: {
    enabled: true,
    maxErrors: 5,
    windowMs: 60_000,
  },
});
```

Aplicación global en la app host:

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiToolkitModule, ErrorRateLimitGuard } from '@rafalejandrorh/nestjs-api-toolkit';

@Module({
  imports: [
    ApiToolkitModule.forRoot({
      storage: { type: 'memory' },
      errorRateLimit: {
        enabled: true,
        maxErrors: 5,
        windowMs: 60_000,
      },
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ErrorRateLimitGuard,
    },
  ],
})
export class AppModule {}
```

Aplicación por ruta o controlador:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ErrorRateLimitGuard } from '@rafalejandrorh/nestjs-api-toolkit';

@Controller('api/login-attempts')
export class LoginAttemptsController {
  @Get()
  @UseGuards(ErrorRateLimitGuard)
  list() {
    return { ok: true };
  }
}
```

Nota operativa importante:

- El guard actual bloquea leyendo el contador `rate-limit:errors:<ip>` desde el storage configurado.
- El incremento de ese contador debe hacerlo la app host o una pieza adicional de tu flujo de autenticación/errores.
- Si no existe contador, el guard deja pasar la request.

## Scripts

```bash
yarn test
yarn test:cov
yarn lint
```

## Estado de Tests

La suite actual cubre:

- módulo y drivers de storage,
- guards de seguridad,
- middleware y repositorios de auditoría (SQL + NoSQL),
- servicio OAuth,
- middlewares y filtro HTTP transversal (unit + integración),
- utilidades core.
