// Exportar el módulo dinámico principal
export * from './api-toolkit.module';

// Exportar los servicios que la app pueda necesitar inyectar
export * from './services/cache.service';

// Exportar las interfaces para que la app tenga tipado fuerte al configurar
export * from './common/interfaces/toolkit-options.interface';

// Exportar utilidades o decoradores personalizados si los tienes
// export * from './decorators/current-user.decorator';