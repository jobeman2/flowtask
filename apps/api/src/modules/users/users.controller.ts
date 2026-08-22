import { Controller, Get, Body, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@flowtask/types';
import { IsNotEmpty, IsString } from 'class-validator';

class UpdateTimezoneDto {
  @IsNotEmpty()
  @IsString()
  timezone: string;
}

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: User) {
    return this.usersService.findById(user.id);
  }

  @Patch('profile/timezone')
  async updateTimezone(
    @CurrentUser() user: User,
    @Body() dto: UpdateTimezoneDto
  ) {
    return this.usersService.updateTimezone(user.id, dto.timezone);
  }
}
