import { IsOptional, IsString } from 'class-validator';

export class TelebirrSmsWebhookDto {
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsString() msg?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() sender?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() secretToken?: string;
}
