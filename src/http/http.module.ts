import { DynamicModule, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { ToolkitOptions } from '../core/interfaces/toolkit-options.interface';
import { TOOLKIT_OPTIONS } from '../core/tokens';
import { JsonExceptionFilter } from './filters/json-exception.filter';
import { ContentTypeMiddleware } from './middlewares/content-type.middleware';
import { ResponseHeaderMiddleware } from './middlewares/response-header.middleware';

@Module({})
export class HttpToolkitModule implements NestModule {
  static forRoot(options: ToolkitOptions): DynamicModule {
    return {
      module: HttpToolkitModule,
      providers: [
        { provide: TOOLKIT_OPTIONS, useValue: options },
        ContentTypeMiddleware,
        ResponseHeaderMiddleware,
        {
          provide: APP_FILTER,
          useClass: JsonExceptionFilter,
        },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ContentTypeMiddleware, ResponseHeaderMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}