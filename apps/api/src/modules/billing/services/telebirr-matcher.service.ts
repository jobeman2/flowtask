import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface ParsedTelebirrSms {
  txId: string | null;
  amount: number | null;
  senderPhone: string | null;
  isValid: boolean;
}

@Injectable()
export class TelebirrMatcherService {
  private readonly logger = new Logger(TelebirrMatcherService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Parse incoming Telebirr SMS to extract Transaction ID, Amount, and Sender Phone
   */
  parseTelebirrSms(rawText: string): ParsedTelebirrSms {
    if (!rawText) {
      return { txId: null, amount: null, senderPhone: null, isValid: false };
    }

    const cleanText = rawText.trim();

    // 1. Extract Transaction ID / Reference Number
    // Patterns: "Trans. ID: 2B7D91X8", "Txn ID: 2B7D91X8", "Transaction No: 2B7D91X8", "Ref: 2B7D91X8", "TxID: 2B7D91X8", "with transaction ID 2B7D91X8"
    let txId: string | null = null;
    const txPatterns = [
      /(?:your\s+)?transaction\s+(?:number|no\.?|id|code)?\s*(?:is|:|=)\s*([a-zA-Z0-9]{5,20})/i,
      /(?:trans(?:action)?\.?\s*(?:id|no\.?|num(?:ber)?)|txn\s*id|ref(?:erence)?\s*(?:no\.?|id)?|txid)\s*(?:is|:|=)?\s*[:#\s-]*([a-zA-Z0-9]{5,20})/i,
      /(?:with transaction ID|with transaction no)\s*[:#\s-]*([a-zA-Z0-9]{5,20})/i,
      /(?:የግብይት\s*ቁጥር|የደረሰኝ\s*ቁጥር)\s*(?:ነው|:)?\s*[:#\s-]*([a-zA-Z0-9]{5,20})/i,
    ];

    for (const pattern of txPatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1]) {
        txId = match[1].trim().toUpperCase();
        break;
      }
    }

    // 2. Extract Amount in ETB / Birr
    // Patterns: "received 350.00 ETB", "credited 350 ETB", "ETB 350.00", "350.00 Birr", "350.00 ብር"
    let amount: number | null = null;
    const amountPatterns = [
      /(?:received|credited|transferred|deposited|amount)\s*[:\s]*(?:ETB|birr|ብር)?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:ETB|birr|ብር)?/i,
      /(?:ETB|birr|ብር)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:ETB|birr|ብር)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1]) {
        const numStr = match[1].replace(/,/g, '');
        const parsed = parseFloat(numStr);
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
          break;
        }
      }
    }

    // 3. Extract Sender Phone if present (e.g. 251911XXXXXX or 0911XXXXXX)
    let senderPhone: string | null = null;
    const phoneMatch = cleanText.match(/(?:from|ከ)\s*[:\s]*((?:\+?251|0)9[0-9]{8})/i);
    if (phoneMatch && phoneMatch[1]) {
      senderPhone = phoneMatch[1].trim();
    }

    const isValid = Boolean(txId && amount && amount > 0);

    return { txId, amount, senderPhone, isValid };
  }

  /**
   * Ingest raw SMS from the SMS gateway or webhook
   */
  async ingestSms(sender: string, rawMessage: string): Promise<any> {
    const parsed = this.parseTelebirrSms(rawMessage);

    this.logger.log(
      `Ingested SMS from ${sender}: TxID=${parsed.txId}, Amount=${parsed.amount} ETB, Valid=${parsed.isValid}`
    );

    // Check if duplicate SMS log
    if (parsed.txId) {
      const existing = await this.prisma.telebirrSmsLog.findUnique({
        where: { extractedTxId: parsed.txId },
      });
      if (existing) {
        this.logger.warn(`SMS with TxID ${parsed.txId} already logged`);
        return { success: true, duplicate: true, log: existing };
      }
    }

    const smsLog = await this.prisma.telebirrSmsLog.create({
      data: {
        sender: sender || 'telebirr',
        rawMessage,
        extractedTxId: parsed.txId,
        extractedAmount: parsed.amount,
        senderPhone: parsed.senderPhone,
        isMatched: false,
      },
    });

    return { success: true, log: smsLog, parsed };
  }

  /**
   * Check if a TxID exists and is unredeemed in the SMS log with sufficient amount
   */
  async matchTransaction(transactionId: string, expectedAmount: number): Promise<{
    matched: boolean;
    smsLog?: any;
    reason?: string;
  }> {
    const cleanTxId = transactionId.trim().toUpperCase();

    // Special Test TT numbers for testing / demonstration without real Telebirr payment
    const testTtCodes = ['TT777', 'TT888', 'TT999', 'TESTPAY', 'FLOW2026', 'TELEBIRR777'];
    if (testTtCodes.includes(cleanTxId) || cleanTxId.startsWith('TT-TEST')) {
      this.logger.log(`⚡ Instant upgrade activated via Test TT code: ${cleanTxId}`);
      return {
        matched: true,
        smsLog: {
          id: 'test-mock-log-id',
          extractedTxId: cleanTxId,
          extractedAmount: expectedAmount,
          isMatched: false,
        },
      };
    }

    const smsLog = await this.prisma.telebirrSmsLog.findFirst({
      where: { extractedTxId: cleanTxId },
    });

    if (!smsLog) {
      return {
        matched: false,
        reason: 'Waiting for Telebirr SMS confirmation. We have recorded your Transaction ID and will activate your plan as soon as the Telebirr SMS is received.',
      };
    }

    if (smsLog.isMatched) {
      return {
        matched: false,
        reason: 'This Telebirr Transaction ID has already been redeemed and used for another subscription.',
      };
    }

    if (smsLog.extractedAmount && smsLog.extractedAmount < expectedAmount) {
      return {
        matched: false,
        reason: `Payment amount (${smsLog.extractedAmount} ETB) is less than required for this plan (${expectedAmount} ETB).`,
      };
    }

    return { matched: true, smsLog };
  }
}
