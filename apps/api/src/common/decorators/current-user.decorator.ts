import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User, TelegramAccount } from '@flowtask/types';

export interface AuthenticatedUser extends User {
  telegramAccount?: TelegramAccount | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    return data && user ? user[data] : user;
  }
);
