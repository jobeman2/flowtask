import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

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

  async updateComment(
    taskId: string,
    commentId: string,
    workspaceId: string,
    dto: UpdateCommentDto,
    userId: string
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      const member = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId, userId },
      });
      if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
        throw new ForbiddenException('You can only edit your own comments');
      }
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
        updatedAt: new Date(),
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async deleteComment(
    taskId: string,
    commentId: string,
    workspaceId: string,
    userId: string
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      const member = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId, userId },
      });
      if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
        throw new ForbiddenException('You can only delete your own comments');
      }
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    return { success: true, message: 'Comment deleted successfully' };
  }
}
