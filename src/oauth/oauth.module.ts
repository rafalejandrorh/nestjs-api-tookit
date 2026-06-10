import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { FindOAuthClientCommand, GenerateOAuthClientCommand } from './commands';

@Module({})
export class OAuthModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    const jwtSecret = options.oauth?.jwtSecret ?? 'change-me';
    const jwtIssuer = options.oauth?.jwtIssuer;
    const jwtAlgorithm = (options.oauth?.jwtAlgorithm ?? 'HS256') as 'HS256';
    const accessTokenExpiresIn = options.oauth?.accessTokenExpiresIn ?? '1h';

    const oauthCommandsEnabled = options.commands?.oauth?.enabled ?? true;
    const commandProviders = oauthCommandsEnabled
      ? [GenerateOAuthClientCommand, FindOAuthClientCommand]
      : [];

    return {
      module: OAuthModule,
      imports: [
        JwtModule.register({
          secret: jwtSecret,
          signOptions: {
            issuer: jwtIssuer,
            algorithm: jwtAlgorithm,
            expiresIn: accessTokenExpiresIn,
          },
        }),
      ],
      providers: [OAuthService, ...commandProviders],
      controllers: [OAuthController],
      exports: [OAuthService],
    };
  }
}