import { IsString, IsNotEmpty } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class ReceiptActionDto {
  @IsString()
  notes?: string;
}

export class UpdatePlanDto {
  @IsString()
  @IsNotEmpty()
  planCode!: string; // 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE'
}
