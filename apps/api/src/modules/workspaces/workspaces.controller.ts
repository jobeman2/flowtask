import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@flowtask/types';
import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { WorkspaceType, WorkspaceRole } from '@flowtask/database';

class CreateWorkspaceDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(WorkspaceType)
  type?: WorkspaceType = WorkspaceType.PERSONAL;
}

class ConnectTelegramGroupDto {
  @IsNotEmpty()
  @IsString()
  chatIdOrUsername: string;
}

class AddMemberDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole = WorkspaceRole.MEMBER;
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

  @Post('connect-telegram-group')
  async connectTelegramGroup(
    @CurrentUser() user: User,
    @Body() dto: ConnectTelegramGroupDto
  ) {
    return this.workspacesService.connectTelegramGroup(user.id, dto.chatIdOrUsername);
  }

  @Get(':id')
  async getWorkspaceById(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User
  ) {
    return this.workspacesService.getWorkspaceById(workspaceId, user.id);
  }

  @Get(':id/members')
  async listMembers(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User
  ) {
    return this.workspacesService.listMembers(workspaceId, user.id);
  }

  @Post(':id/members')
  async addMember(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User,
    @Body() dto: AddMemberDto
  ) {
    return this.workspacesService.addMember(workspaceId, user.id, dto);
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: User
  ) {
    return this.workspacesService.removeMember(workspaceId, user.id, memberId);
  }

  @Post(':id/leave')
  async leaveWorkspace(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User
  ) {
    return this.workspacesService.leaveWorkspace(workspaceId, user.id);
  }

  @Delete(':id')
  async deleteWorkspace(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User
  ) {
    return this.workspacesService.deleteWorkspace(workspaceId, user.id);
  }

  @Post(':id/sync-telegram-group')
  async syncTelegramGroup(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User
  ) {
    return this.workspacesService.syncTelegramGroup(workspaceId, user.id);
  }
}
