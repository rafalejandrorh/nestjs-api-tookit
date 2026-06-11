import { Module } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';
import type { ToolkitOptions } from './core/interfaces/toolkit-options.interface';
import { OAuthModule } from './oauth/oauth.module';

const cliOptions: ToolkitOptions = {
  storage: { type: 'memory' },
  oauth: {
    enabled: true,
    repository: 'options',
    jwtSecret: process.env.TOOLKIT_JWT_SECRET ?? 'change-me',
    clients: [],
  },
  commands: {
    oauth: {
      enabled: true,
    },
  },
};

@Module({
  imports: [OAuthModule.forRoot(cliOptions)],
})
class ToolkitCliModule {}

async function bootstrapCli() {
  try {
    // CommandFactory arranca la app de Nest enfocada en comandos, no en HTTP
    await CommandFactory.run(ToolkitCliModule, {
      logger: ['warn', 'error'], // Ocultamos los logs normales de Nest para una terminal más limpia
    });
  } catch (error) {
    console.error('Error iniciando el CLI:', error);
    process.exit(1);
  }
}

bootstrapCli();