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
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { User } from '@flowtask/types';

@Controller('projects')
@UseGuards(WorkspaceGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  async listProjects(@Query('workspaceId') workspaceId: string) {
    return this.projectsService.listProjects(workspaceId);
  }

  @Get(':id')
  async getProjectById(
    @Param('id') projectId: string,
    @Query('workspaceId') workspaceId: string
  ) {
    return this.projectsService.getProjectById(projectId, workspaceId);
  }

  @Post()
  async createProject(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: User
  ) {
    return this.projectsService.createProject(dto, user.id);
  }

  @Patch(':id')
  async updateProject(
    @Param('id') projectId: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: User
  ) {
    return this.projectsService.updateProject(projectId, workspaceId, dto, user.id);
  }

  @Delete(':id/archive')
  async archiveProject(
    @Param('id') projectId: string,
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: User
  ) {
    return this.projectsService.archiveProject(projectId, workspaceId, user.id);
  }
}
