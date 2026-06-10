// Exportar el módulo dinámico principal
export * from './api-toolkit.module';

// Exportar features reutilizables
export * from './storage';
export * from './audit';
export * from './cache';
export * from './security';
export * from './oauth';
export * from './http';

// Exportar las interfaces para que la app tenga tipado fuerte al configurar
export * from './core/interfaces/toolkit-options.interface';

// Exportar tokens para integraciones avanzadas por DI
export * from './core/tokens';

// Exportar utilidades o decoradores personalizados si los tienes
// export * from './decorators/current-user.decorator';