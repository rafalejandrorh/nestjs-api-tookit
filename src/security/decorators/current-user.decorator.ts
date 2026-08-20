import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  TOOLKIT_REQUEST_USER,
  type ToolkitAuthUser,
} from '../interfaces/toolkit-auth-user.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof ToolkitAuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    const user = (request[TOOLKIT_REQUEST_USER] ?? request.user) as ToolkitAuthUser | undefined;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
