import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  workspaceId: string;

  @IsString()
  planCode: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;
}
