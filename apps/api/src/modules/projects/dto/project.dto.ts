import { IsNotEmpty, IsString, IsOptional, IsUUID, Matches } from 'class-validator';

export class CreateProjectDto {
  @IsNotEmpty()
  @IsString()
  workspaceId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid 6-character hex color code (e.g. #3b82f6)' })
  color?: string = '#3b82f6';
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid 6-character hex color code' })
  color?: string;
}
