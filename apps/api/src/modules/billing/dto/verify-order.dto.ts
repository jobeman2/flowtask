import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class VerifyOrderDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @IsString()
  @IsOptional()
  receiptImageUrl?: string;
}
