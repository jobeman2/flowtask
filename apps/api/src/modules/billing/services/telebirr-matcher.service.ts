import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TelebirrMatcherService {
  private readonly logger = new Logger(TelebirrMatcherService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Extracts a Telebirr transaction ID from a raw SMS message.
   * Telebirr SMS format example:
   * "You have received ETB 199.00 from 09XXXXXXXX. Your transaction ID is TT12345678."
   */
  extractTransactionId(rawMessage: string): string | null {
    const match = rawMessage.match(/(?:transaction\s+ID\s+is|TxID[:\s]+|Ref[:\s]+)\s*([A-Z0-9]{6,20})/i);
    return match ? match[1].trim().toUpperCase() : null;
  }

  extractAmount(rawMessage: string): number | null {
    const match = rawMessage.match(/(?:received|paid|ETB)[:\s]+([\d,]+(?:\.\d{1,2})?)/i);
    if (!match) return null;
    return parseFloat(match[1].replace(/,/g, ''));
  }

  /**
   * Tries to auto-match an SMS to a pending payment order by transaction ID or amount.
   */
  async matchSmsToOrder(
    sender: string,
    rawMessage: string,
  ): Promise<{ matched: boolean; orderId?: string; transactionId?: string }> {
    const txId = this.extractTransactionId(rawMessage);
    const amount = this.extractAmount(rawMessage);

    // Log the incoming SMS for auditing
    const logEntry = await this.prisma.telebirrSmsLog.create({
      data: {
        sender,
        rawMessage,
        extractedTxId: txId,
        extractedAmount: amount,
        isMatched: false,
      },
    });

    if (!txId) {
      this.logger.warn(`Could not extract TxID from SMS: "${rawMessage.slice(0, 80)}"`);
      return { matched: false };
    }

    // Try to find a matching pending order
    const order = await this.prisma.paymentOrder.findFirst({
      where: {
        status: 'PENDING',
        ...(amount ? { amountEtb: { gte: amount - 1, lte: amount + 1 } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!order) {
      return { matched: false, transactionId: txId };
    }

    // Mark order as verified and update the SMS log
    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: { transactionId: txId, status: 'VERIFIED', verifiedAt: new Date() },
    });

    await this.prisma.telebirrSmsLog.update({
      where: { id: logEntry.id },
      data: { isMatched: true, matchedOrderId: order.id },
    });

    this.logger.log(`Auto-matched SMS TxID ${txId} to order ${order.orderCode}`);
    return { matched: true, orderId: order.id, transactionId: txId };
  }
}
