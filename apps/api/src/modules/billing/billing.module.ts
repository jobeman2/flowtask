import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './services/billing.service';
import { TelebirrMatcherService } from './services/telebirr-matcher.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  controllers: [BillingController],
  providers: [BillingService, TelebirrMatcherService],
  exports: [BillingService, TelebirrMatcherService],
})
export class BillingModule {}
