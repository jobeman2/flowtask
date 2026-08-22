import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCommentDto } from './dto/comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async listComments(taskId: string, workspaceId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.comment.findMany({
      where: { taskId },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(
    taskId: string,
    workspaceId: string,
    dto: CreateCommentDto,
    authorId: string
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          taskId,
          authorId,
          content: dto.content,
        },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          actorId: authorId,
          entityType: 'COMMENT',
          entityId: comment.id,
          action: 'COMMENT_ADDED',
          metadata: { taskId, snippet: dto.content.substring(0, 50) },
        },
      });

      return comment;
    });
  }
}
