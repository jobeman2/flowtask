import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@flowtask/types';
import { IsNotEmpty, IsString } from 'class-validator';

class TelegramAuthDto {
  @IsNotEmpty()
  @IsString()
  initData: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('telegram')
  async authenticateTelegram(@Body() dto: TelegramAuthDto) {
    return this.authService.validateAndAuthenticateTelegramUser(dto.initData);
  }

  @Get('me')
  async getProfile(@CurrentUser() user: User) {
    return this.authService.getSession(user.id);
  }
}
