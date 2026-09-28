import { IsString, IsOptional } from 'class-validator';

export class VerifyOrderDto {
  @IsString()
  orderId: string;

  @IsString()
  transactionId: string;

  @IsOptional()
  @IsString()
  receiptImageUrl?: string;
}
