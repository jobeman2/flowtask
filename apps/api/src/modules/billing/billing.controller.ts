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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  async getPlans() {
    const plans = await this.billingService.getPlans();
    return { success: true, data: plans };
  }

  @UseGuards(JwtAuthGuard)
  @Get('workspace/:workspaceId')
  async getWorkspaceSubscription(@Param('workspaceId') workspaceId: string) {
    const sub = await this.billingService.getWorkspaceSubscription(workspaceId);
    return { success: true, data: sub };
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders')
  async createPaymentOrder(@Request() req: any, @Body() dto: CreateOrderDto) {
    const order = await this.billingService.createPaymentOrder(req.user.id, dto);
    return { success: true, data: order };
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-order')
  async verifyPaymentOrder(@Request() req: any, @Body() dto: VerifyOrderDto) {
    const result = await this.billingService.verifyPaymentOrder(req.user.id, dto);
    return { success: true, data: result };
  }

  @Post('telebirr-sms-webhook')
  async handleSmsWebhook(
    @Headers('x-sms-secret') headerSecret: string,
    @Body() dto: TelebirrSmsWebhookDto
  ) {
    const secret = dto.secretToken || headerSecret;
    const result = await this.billingService.handleSmsWebhook(
      dto.sender || 'telebirr',
      dto.message,
      secret
    );
    return result;
  }
}
