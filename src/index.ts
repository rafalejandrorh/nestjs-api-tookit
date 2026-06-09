// Exportar el módulo dinámico principal
export * from './api-toolkit.module';

// Exportar módulos internos reutilizables
export * from './cache/cache.module';
export * from './security/security.module';

// Exportar los servicios que la app pueda necesitar inyectar
export * from './services/cache.service';

// Exportar las interfaces para que la app tenga tipado fuerte al configurar
export * from './core/interfaces/toolkit-options.interface';

// Exportar tokens para integraciones avanzadas por DI
export * from './core/tokens';

// Exportar utilidades o decoradores personalizados si los tienes
// export * from './decorators/current-user.decorator';