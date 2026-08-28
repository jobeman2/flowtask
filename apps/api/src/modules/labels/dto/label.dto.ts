import { IsNotEmpty, IsString, IsOptional, IsUUID, Matches } from 'class-validator';

export class CreateLabelDto {
  @IsNotEmpty()
  @IsString()
  workspaceId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid 6-character hex color code (e.g. #6366f1)' })
  color: string;
}

export class UpdateLabelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid 6-character hex color code' })
  color?: string;
}
