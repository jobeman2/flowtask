import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActivityService } from './activity.service';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';

@Controller('activity')
@UseGuards(WorkspaceGuard)
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get()
  async listWorkspaceActivity(
    @Query('workspaceId') workspaceId: string,
    @Query('limit') limit?: number
  ) {
    return this.activityService.listWorkspaceActivity(workspaceId, limit ? Number(limit) : 50);
  }

  @Get(':entityType/:entityId')
  async listEntityActivity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('workspaceId') workspaceId: string
  ) {
    return this.activityService.listEntityActivity(entityType.toUpperCase(), entityId, workspaceId);
  }
}
