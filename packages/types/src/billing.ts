export type PlanTier = 'FREE' | 'STANDARD' | 'PRO' | 'ENTERPRISE';

export type PaymentStatus =
  | 'PENDING'
  | 'PENDING_VERIFICATION'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED';

export interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  priceEtbMonth: number;
  maxProjects: number;
  maxMembers: number;
  maxTasks?: number;
  maxGroups?: number;
  hasAiFeatures: boolean;
  hasAttachments?: boolean;
  hasDailyDigest?: boolean;
  hasRecurring?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  workspaceId: string;
  planId: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'TRIALING';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  plan?: Plan;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentOrder {
  id: string;
  orderCode: string;
  workspaceId: string;
  userId: string;
  planCode: string;
  amountEtb: number;
  durationDays: number;
  status: PaymentStatus;
  transactionId?: string | null;
  receiptImageUrl?: string | null;
  telebirrPhone?: string | null;
  payerName?: string | null;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TelebirrSmsLog {
  id: string;
  sender: string;
  rawMessage: string;
  extractedTxId?: string | null;
  extractedAmount?: number | null;
  senderPhone?: string | null;
  isMatched: boolean;
  matchedOrderId?: string | null;
  receivedAt: Date;
}

export interface CreateOrderDto {
  workspaceId: string;
  planCode: string;
  durationDays?: number;
}

export interface VerifyOrderDto {
  orderId: string;
  transactionId: string;
  receiptImageUrl?: string;
}

export interface TelebirrSmsWebhookDto {
  sender: string;
  message: string;
  secretToken?: string;
}
