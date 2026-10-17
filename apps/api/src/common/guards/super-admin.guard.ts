import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required for admin access');
    }

    // Check if user has isSuperAdmin flag or matches admin telegram ID
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
    const isOwnerTelegram =
      adminTelegramId &&
      user.telegramAccount?.telegramId &&
      String(user.telegramAccount.telegramId) === String(adminTelegramId);

    if (user.isSuperAdmin || isOwnerTelegram || user.email === 'admin@flowtask.app') {
      return true;
    }

    throw new ForbiddenException('Super Administrator access required');
  }
}
