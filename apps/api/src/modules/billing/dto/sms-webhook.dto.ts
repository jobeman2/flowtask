import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class TelebirrSmsWebhookDto {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsOptional()
  sender?: string;

  @IsString()
  @IsOptional()
  secretToken?: string;
}
