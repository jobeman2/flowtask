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
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { User } from '@flowtask/types';
import { TaskStatus } from '@flowtask/database';

@Controller('tasks')
@UseGuards(WorkspaceGuard)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get()
  async listTasks(
    @Query('workspaceId') workspaceId: string,
    @Query() query: PaginationDto & { status?: TaskStatus; projectId?: string; assigneeId?: string },
    @CurrentUser() user: User
  ) {
    return this.tasksService.listTasks(workspaceId, user.id, query);
  }

  @Get('stats/summary')
  async getWorkspaceStats(
    @Query('workspaceId') workspaceId: string
  ) {
    return this.tasksService.getWorkspaceStats(workspaceId);
  }

  @Get(':id')
  async getTaskById(
    @Param('id') taskId: string,
    @Query('workspaceId') workspaceId: string
  ) {
    return this.tasksService.getTaskById(taskId, workspaceId);
  }

  @Post()
  async createTask(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: User
  ) {
    return this.tasksService.createTask(dto, user.id);
  }

  @Patch(':id')
  async updateTask(
    @Param('id') taskId: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: User
  ) {
    return this.tasksService.updateTask(taskId, workspaceId, dto, user.id);
  }

  @Post(':id/complete')
  async completeTask(
    @Param('id') taskId: string,
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: User
  ) {
    return this.tasksService.completeTask(taskId, workspaceId, user.id);
  }

  @Delete(':id')
  async deleteTask(
    @Param('id') taskId: string,
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: User
  ) {
    return this.tasksService.deleteTask(taskId, workspaceId, user.id);
  }
}
