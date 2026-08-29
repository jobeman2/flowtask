import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { TaskStatus, TaskPriority } from '@flowtask/database';

export class CreateTaskDto {
  @IsNotEmpty()
  @IsString()
  workspaceId: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus = TaskStatus.TODO;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labelIds?: string[];

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
