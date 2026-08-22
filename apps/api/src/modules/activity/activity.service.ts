import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async listWorkspaceActivity(workspaceId: string, limit = 50) {
    return this.prisma.activityLog.findMany({
      where: { workspaceId },
      include: {
        actor: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  async listEntityActivity(entityType: string, entityId: string, workspaceId: string) {
    return this.prisma.activityLog.findMany({
      where: {
        workspaceId,
        entityType,
        entityId,
      },
      include: {
        actor: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
