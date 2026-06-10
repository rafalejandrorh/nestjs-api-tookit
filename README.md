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

## Peer Dependencies Por Feature

La librería define peers mínimos obligatorios y peers opcionales por feature.

Peers obligatorios (siempre):

- `@nestjs/common`
- `@nestjs/core`
- `reflect-metadata`
- `rxjs`

Peers opcionales (marcados con `peerDependenciesMeta.optional: true`):

| Feature | Peers opcionales |
| --- | --- |
| OAuth (`oauth.enabled: true`) | `@nestjs/jwt` |
| OAuth comandos (`commands.oauth.enabled: true`) | `nest-commander` |
| OAuth SQL (`oauth.repository: 'sql'`) | `@nestjs/typeorm`, `typeorm`, `pg` (si `sqlType: 'postgres'`) |
| OAuth NoSQL (`oauth.repository: 'nosql'`) | `@nestjs/mongoose`, `mongoose` |
| Audit SQL (`audit.repository: 'sql'`) | `@nestjs/typeorm`, `typeorm`, `pg` (si `sqlType: 'postgres'`) |
| Audit NoSQL (`audit.repository: 'nosql'`) | `@nestjs/mongoose`, `mongoose` |
| Storage Redis (`storage.type: 'redis'`) | `@liaoliaots/nestjs-redis`, `ioredis` |

Validación runtime:

- El toolkit valida dependencias opcionales solo cuando activas la feature correspondiente.
- Si falta un peer opcional, lanza un error explícito indicando qué paquete instalar.
- Si no usas una feature opcional, no necesitas instalar sus peers.

Instalación por escenario (ejemplos):

```bash
# Base (sin features opcionales)
yarn add @nestjs/common @nestjs/core reflect-metadata rxjs @rafalejandrorh/nestjs-api-toolkit

# OAuth + SQL (Postgres)
yarn add @nestjs/jwt @nestjs/typeorm typeorm pg

# OAuth/Audit NoSQL
yarn add @nestjs/mongoose mongoose

# Storage Redis
yarn add @liaoliaots/nestjs-redis ioredis

# Comandos OAuth CLI
yarn add nest-commander
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

Configuración con SQL:

```ts
ApiToolkitModule.forRoot({
  storage: { type: 'memory' },
  oauth: {
    enabled: true,
    repository: 'sql',
    jwtSecret: process.env.JWT_SECRET,
    jwtIssuer: 'my-api',
    jwtAlgorithm: 'HS256',
    accessTokenExpiresIn: '1h',
    config: {
      connection: process.env.DATABASE_URL,
      sqlType: 'postgres',
      synchronize: false,
    },
  },
});
```

Configuración con MongoDB/Mongoose:

```ts
ApiToolkitModule.forRoot({
  storage: { type: 'memory' },
  oauth: {
    enabled: true,
    repository: 'nosql',
    jwtSecret: process.env.JWT_SECRET,
    jwtIssuer: 'my-api',
    jwtAlgorithm: 'HS256',
    accessTokenExpiresIn: '1h',
    config: {
      connection: process.env.MONGODB_URI,
      collection: 'oauth_clients',
    },
  },
});
```

Repositorios OAuth soportados:

- `oauth.repository: 'sql'`: busca clientes en DB SQL vía TypeORM.
- `oauth.repository: 'nosql'`: busca clientes en MongoDB vía Mongoose.
- `oauth.repository: 'options'` (default): compatibilidad legacy leyendo `oauth.clients` del config.

Si usas `sql` o `nosql`, `oauth.config.connection` es obligatorio.

Notas:

- Usa `oauth.repository: 'sql'` si ya gestionas clientes OAuth en una tabla relacional como `oauth_clients`.
- Usa `oauth.repository: 'nosql'` si prefieres almacenar clientes OAuth en una colección MongoDB.
- `oauth.repository: 'options'` sigue siendo útil para pruebas rápidas o entornos muy simples, pero para producción la opción recomendada es persistirlos en BD.

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
    maxAttempts404: 5,
    banDurationMs: 60_000,
    // Compat legacy (fallback):
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
        maxAttempts404: 5,
        banDurationMs: 60_000,
        // Compat legacy (fallback):
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

- El middleware de seguridad incrementa en runtime `ip_404_attempts_<ip>` cuando una respuesta termina en `404`.
- El guard bloquea si `banned_ip_<ip>` existe o si los intentos superan `maxAttempts404`.
- Al superar el umbral, se crea el ban temporal (`banned_ip_<ip>`) y se resetea `ip_404_attempts_<ip>`.
- `maxErrors/windowMs` siguen soportados como compatibilidad hacia atrás cuando no se define `maxAttempts404/banDurationMs`.

## Comandos Disponibles

Scripts del paquete:

```bash
yarn build
yarn test
yarn test:cov
yarn lint
```

Comandos CLI OAuth (nest-commander):

```bash
yarn ts-node -r tsconfig-paths/register src/main.ts toolkit:oauth-client:generate
yarn ts-node -r tsconfig-paths/register src/main.ts toolkit:oauth-client:find <clientId>
```

`toolkit:oauth-client:generate`:

- genera `clientId` y `clientSecret` aleatorios si no se envían.
- flags disponibles:
  - `--client-id [clientId]`
  - `--client-secret [clientSecret]`
  - `--scopes [scope1,scope2]`
  - `--username [username]`
  - `--password [password]`

Ejemplo:

```bash
yarn ts-node -r tsconfig-paths/register src/main.ts toolkit:oauth-client:generate --scopes read,write --username alice --password alice-password
```

`toolkit:oauth-client:find <clientId>`:

- busca el cliente en `oauth.clients` de la configuración actual.
- por defecto redacta `clientSecret`.
- flag opcional:
  - `--reveal-secret true`

Ejemplo:

```bash
yarn ts-node -r tsconfig-paths/register src/main.ts toolkit:oauth-client:find my-client --reveal-secret true
```

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
