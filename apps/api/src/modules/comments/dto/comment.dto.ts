import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  content: string;
}

export class UpdateCommentDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  content: string;
}
