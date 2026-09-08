import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (isPublic) {
        return true;
      }
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    const workspaceId =
      request.params.workspaceId ||
      request.headers['x-workspace-id'] ||
      request.query.workspaceId ||
      request.body?.workspaceId;

    if (!workspaceId) {
      // If no workspace context requested, continue
      return true;
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId: user.id },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const membership = workspace.members?.[0];
    if (!membership && workspace.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    request.workspaceContext = {
      workspace,
      membership: membership || {
        id: 'owner',
        workspaceId: workspace.id,
        userId: user.id,
        role: 'OWNER',
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
    };

    return true;
  }
}
