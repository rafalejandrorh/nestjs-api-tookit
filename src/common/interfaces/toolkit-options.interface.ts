// toolkit-options.interface.ts
export interface ToolkitOptions {
  globalMatch?: {
    include: (string | RegExp)[]; // Ej: ['/api/v1/.*', '/auth/.*']
    exclude?: (string | RegExp)[]; // Ej: ['/api/v1/public/.*']
  };
  storage: {
    type: 'redis' | 'memory' | 'filesystem';
    config?: any; // Credenciales de Redis, rutas de carpetas, etc.
  };
  oauth?: {
    enabled: boolean;
    // URL del authorization server, scopes, etc.
  };
  hmac?: {
    enabled: boolean;
    secretKey: string;
  };
  errorRateLimit?: {
    enabled: boolean;
    maxErrors: number;
    windowMs: number;
  };
  audit?: {
    enabled: boolean;
    repository: 'sql' | 'nosql';
    config?: {
      connection: string; // Configuración de conexión para la base de datos
    }; // Configuración específica para cada tipo de repositorio
  };
}