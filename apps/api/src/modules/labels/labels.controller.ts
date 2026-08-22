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
import { LabelsService } from './labels.service';
import { CreateLabelDto, UpdateLabelDto } from './dto/label.dto';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';

@Controller('labels')
@UseGuards(WorkspaceGuard)
export class LabelsController {
  constructor(private labelsService: LabelsService) {}

  @Get()
  async listLabels(@Query('workspaceId') workspaceId: string) {
    return this.labelsService.listLabels(workspaceId);
  }

  @Post()
  async createLabel(@Body() dto: CreateLabelDto) {
    return this.labelsService.createLabel(dto);
  }

  @Patch(':id')
  async updateLabel(
    @Param('id') labelId: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: UpdateLabelDto
  ) {
    return this.labelsService.updateLabel(labelId, workspaceId, dto);
  }

  @Delete(':id')
  async deleteLabel(
    @Param('id') labelId: string,
    @Query('workspaceId') workspaceId: string
  ) {
    return this.labelsService.deleteLabel(labelId, workspaceId);
  }
}
