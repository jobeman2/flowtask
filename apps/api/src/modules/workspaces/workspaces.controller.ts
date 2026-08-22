import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@flowtask/types';
import { IsNotEmpty, IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { WorkspaceType, WorkspaceRole } from '@flowtask/database';

class CreateWorkspaceDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(WorkspaceType)
  type?: WorkspaceType;
}

class AddMemberDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;
}

@Controller('workspaces')
export class WorkspacesController {
  constructor(private workspacesService: WorkspacesService) {}

  @Get()
  async listUserWorkspaces(@CurrentUser() user: User) {
    return this.workspacesService.listUserWorkspaces(user.id);
  }

  @Post()
  async createWorkspace(
    @CurrentUser() user: User,
    @Body() dto: CreateWorkspaceDto
  ) {
    return this.workspacesService.createWorkspace(user.id, dto.name, dto.type);
  }

  @Get(':id')
  async getWorkspaceById(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User
  ) {
    return this.workspacesService.getWorkspaceById(workspaceId, user.id);
  }

  @Post(':id/members')
  async addMember(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User,
    @Body() dto: AddMemberDto
  ) {
    return this.workspacesService.addMember(workspaceId, user.id, dto.userId, dto.role);
  }
}
