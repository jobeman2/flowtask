import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateLabelDto, UpdateLabelDto } from './dto/label.dto';

@Injectable()
export class LabelsService {
  constructor(private prisma: PrismaService) {}

  async listLabels(workspaceId: string) {
    return this.prisma.label.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  async createLabel(dto: CreateLabelDto) {
    const existing = await this.prisma.label.findUnique({
      where: {
        workspaceId_name: {
          workspaceId: dto.workspaceId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Label "${dto.name}" already exists in this workspace`);
    }

    return this.prisma.label.create({
      data: {
        workspaceId: dto.workspaceId,
        name: dto.name,
        color: dto.color,
      },
    });
  }

  async updateLabel(labelId: string, workspaceId: string, dto: UpdateLabelDto) {
    const existing = await this.prisma.label.findFirst({
      where: { id: labelId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Label not found');
    }

    return this.prisma.label.update({
      where: { id: labelId },
      data: dto,
    });
  }

  async deleteLabel(labelId: string, workspaceId: string) {
    const existing = await this.prisma.label.findFirst({
      where: { id: labelId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Label not found');
    }

    await this.prisma.label.delete({ where: { id: labelId } });
    return { deleted: true };
  }
}
