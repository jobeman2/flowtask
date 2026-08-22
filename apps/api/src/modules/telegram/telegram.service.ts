import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private configService: ConfigService) {}

  verifyWebhookSecret(headerSecret: string): boolean {
    const configuredSecret = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!configuredSecret) return true; // If not configured in dev, pass
    return headerSecret === configuredSecret;
  }

  async handleUpdate(update: any) {
    this.logger.log(`Received Telegram webhook update ID: ${update?.update_id}`);
    // In Phase 1, acknowledge and log the webhook.
    // In Phase 3, this invokes the Bot Dispatcher service.
    return { ok: true };
  }
}
