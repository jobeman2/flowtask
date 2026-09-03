import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BillingService } from './services/billing.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyOrderDto } from './dto/verify-order.dto';
import { TelebirrSmsWebhookDto } from './dto/sms-webhook.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Get('plans')
  async getPlans() {
    const plans = await this.billingService.getPlans();
    return { success: true, data: plans };
  }

  @Get('me')
  async getMySubscription(@Request() req: any) {
    const sub = await this.billingService.getUserSubscription(req.user.id);
    return { success: true, data: sub };
  }

  @Get('workspace/:workspaceId')
  async getWorkspaceSubscription(@Param('workspaceId') workspaceId: string) {
    const sub = await this.billingService.getWorkspaceSubscription(workspaceId);
    return { success: true, data: sub };
  }

  @Post('orders')
  async createPaymentOrder(@Request() req: any, @Body() dto: CreateOrderDto) {
    const order = await this.billingService.createPaymentOrder(req.user.id, dto);
    return { success: true, data: order };
  }

  @Post('verify-order')
  async verifyPaymentOrder(@Request() req: any, @Body() dto: VerifyOrderDto) {
    const result = await this.billingService.verifyPaymentOrder(req.user.id, dto);
    return { success: true, data: result };
  }

  @Public()
  @Post('telebirr-sms-webhook')
  async handleSmsWebhook(
    @Headers('x-sms-secret') headerSecret: string,
    @Body() dto: TelebirrSmsWebhookDto
  ) {
    const secret = dto.secretToken || headerSecret;
    let rawText = dto.message || dto.text || dto.body || dto.msg || dto.content || '';
    if (rawText) {
      rawText = rawText.replace(/<[^>]*>/g, ' ');
    }
    const sender = dto.sender || dto.from || 'telebirr';
    const result = await this.billingService.handleSmsWebhook(
      sender,
      rawText,
      secret
    );
    return result;
  }
}
