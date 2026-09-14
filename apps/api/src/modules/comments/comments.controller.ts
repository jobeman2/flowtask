import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { User } from '@flowtask/types';

@Controller('tasks/:taskId/comments')
@UseGuards(WorkspaceGuard)
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get()
  async listComments(
    @Param('taskId') taskId: string,
    @Query('workspaceId') workspaceId: string
  ) {
    return this.commentsService.listComments(taskId, workspaceId);
  }

  @Post()
  async addComment(
    @Param('taskId') taskId: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: User
  ) {
    return this.commentsService.addComment(taskId, workspaceId, dto, user.id);
  }

  @Patch(':commentId')
  async updateComment(
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: User
  ) {
    return this.commentsService.updateComment(
      taskId,
      commentId,
      workspaceId,
      dto,
      user.id
    );
  }

  @Delete(':commentId')
  async deleteComment(
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: User
  ) {
    return this.commentsService.deleteComment(
      taskId,
      commentId,
      workspaceId,
      user.id
    );
  }
}
