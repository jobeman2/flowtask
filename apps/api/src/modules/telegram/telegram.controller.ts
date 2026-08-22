import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('telegram')
export class TelegramController {
  constructor(private telegramService: TelegramService) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
    @Body() update: Record<string, unknown>
  ) {
    if (!this.telegramService.verifyWebhookSecret(secretToken)) {
      throw new UnauthorizedException('Invalid Telegram webhook secret token');
    }

    return this.telegramService.handleUpdate(update);
  }
}
