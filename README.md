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
