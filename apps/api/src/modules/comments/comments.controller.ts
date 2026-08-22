import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/comment.dto';
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
}
