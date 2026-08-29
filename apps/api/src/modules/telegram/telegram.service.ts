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
    return { ok: true };
  }

  async sendTelegramMessage(
    telegramId: string,
    text: string,
    options?: { reply_markup?: any; parse_mode?: string }
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || token === 'mock_token_for_dev') {
      this.logger.log(`[Mock Bot DM to ${telegramId}]: ${text}`);
      return { ok: true, mock: true };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId,
          text,
          parse_mode: options?.parse_mode || 'Markdown',
          reply_markup: options?.reply_markup,
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        this.logger.warn(`Failed to send Telegram message to ${telegramId}: ${data.description}`);
      } else {
        this.logger.log(`Telegram DM sent successfully to ${telegramId}`);
      }
      return data;
    } catch (err: any) {
      this.logger.error(`Error sending Telegram message to ${telegramId}: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  async getChatAdministrators(chatId: string): Promise<any[]> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || token === 'mock_token_for_dev') {
      return [];
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getChatAdministrators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId }),
      });
      const data = await response.json();
      if (data.ok && Array.isArray(data.result)) {
        return data.result;
      }
      this.logger.warn(`Failed to get chat administrators for ${chatId}: ${data.description}`);
      return [];
    } catch (err: any) {
      this.logger.error(`Error fetching chat administrators for ${chatId}: ${err.message}`);
      return [];
    }
  }

  async getChatInfo(chatId: string): Promise<any> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || token === 'mock_token_for_dev') {
      return null;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId }),
      });
      const data = await response.json();
      if (data.ok && data.result) {
        return data.result;
      }
      return null;
    } catch (err: any) {
      this.logger.error(`Error fetching chat info for ${chatId}: ${err.message}`);
      return null;
    }
  }

  async notifyWorkspaceInvite(data: {
    targetTelegramId?: string;
    workspaceName: string;
    role: string;
    inviterName: string;
  }) {
    if (!data.targetTelegramId) return;

    const webAppUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://localhost:3000';
    const text =
      `👋 *You've been invited to a Team Workspace!*\n\n` +
      `🏢 *Workspace:* *${data.workspaceName}*\n` +
      `🛡️ *Role:* \`${data.role}\`\n` +
      `👤 *Invited by:* *${data.inviterName}*\n\n` +
      `You can now view, collaborate, and manage shared tasks in this workspace.`;

    return this.sendTelegramMessage(data.targetTelegramId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '👥 Open Team in Mini App', web_app: { url: webAppUrl } }],
        ],
      },
    });
  }

  async notifyTaskAssigned(data: {
    targetTelegramId?: string;
    taskId?: string;
    taskTitle: string;
    priority: string;
    workspaceName: string;
    assignerName: string;
    dueDate?: string | null;
  }) {
    if (!data.targetTelegramId) return;

    const webAppUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://localhost:3000';
    const dueInfo = data.dueDate
      ? `\n⏰ *Due:* ${new Date(data.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : '';

    const priorityEmoji =
      data.priority === 'URGENT' ? '🚨' : data.priority === 'HIGH' ? '🔥' : data.priority === 'MEDIUM' ? '⚡' : '☕';

    const text =
      `📬 *Telegram Inbox — Task Assigned to You!*\n\n` +
      `📝 *Task:* *${data.taskTitle}*\n` +
      `${priorityEmoji} *Priority:* \`${data.priority}\`\n` +
      `🏢 *Workspace:* *${data.workspaceName}*\n` +
      `👤 *Assigned by:* *${data.assignerName}*${dueInfo}\n\n` +
      `_This task is now in your FlowTask Mini App and Telegram task list._`;

    const inlineKeyboard: any[] = [
      [{ text: '📱 Open in FlowTask Mini App', web_app: { url: webAppUrl } }],
    ];

    if (data.taskId) {
      inlineKeyboard.push([
        { text: '✅ Mark Done', callback_data: `task:done:${data.taskId}` },
        { text: '🔍 View Details', callback_data: `task:view:${data.taskId}` },
      ]);
    }

    return this.sendTelegramMessage(data.targetTelegramId, text, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }

  async notifyTaskCreatedForCreator(data: {
    targetTelegramId?: string;
    taskId?: string;
    taskTitle: string;
    priority: string;
    workspaceName: string;
    assigneeName?: string | null;
    dueDate?: string | null;
  }) {
    if (!data.targetTelegramId) return;

    const webAppUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://localhost:3000';
    const dueInfo = data.dueDate
      ? `\n⏰ *Due:* ${new Date(data.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : '';

    const priorityEmoji =
      data.priority === 'URGENT' ? '🚨' : data.priority === 'HIGH' ? '🔥' : data.priority === 'MEDIUM' ? '⚡' : '☕';

    const text =
      `✅ *Task Created Confirmation*\n\n` +
      `📝 *Task:* *${data.taskTitle}*\n` +
      `${priorityEmoji} *Priority:* \`${data.priority}\`\n` +
      `🏢 *Workspace:* *${data.workspaceName}*\n` +
      `👤 *Assigned to:* *${data.assigneeName || 'You (Personal)'}*${dueInfo}\n\n` +
      `_You will receive updates here when this task is completed._`;

    const inlineKeyboard: any[] = [
      [{ text: '📱 View in FlowTask Mini App', web_app: { url: webAppUrl } }],
    ];

    if (data.taskId) {
      inlineKeyboard.push([
        { text: '✅ Mark Done', callback_data: `task:done:${data.taskId}` },
        { text: '🔍 View Details', callback_data: `task:view:${data.taskId}` },
      ]);
    }

    return this.sendTelegramMessage(data.targetTelegramId, text, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }

  async notifyTaskCompleted(data: {
    targetTelegramId?: string;
    taskTitle: string;
    workspaceName: string;
    completedByName: string;
  }) {
    if (!data.targetTelegramId) return;

    const webAppUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://localhost:3000';
    const text =
      `🎉 *Task Completed!*\n\n` +
      `📝 *Task:* *${data.taskTitle}*\n` +
      `🏢 *Workspace:* *${data.workspaceName}*\n` +
      `✅ *Completed by:* *${data.completedByName}*\n\n` +
      `Great job! The task is now archived as done.`;

    return this.sendTelegramMessage(data.targetTelegramId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📱 Open Mini App Board', web_app: { url: webAppUrl } }],
        ],
      },
    });
  }

  async notifyGroupTaskCreated(data: {
    groupChatId: string;
    taskId: string;
    taskTitle: string;
    priority: string;
    workspaceName: string;
    creatorName: string;
    assigneeName?: string | null;
    dueDate?: string | null;
  }) {
    const webAppUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://localhost:3000';
    const dueInfo = data.dueDate
      ? `\n⏰ *Due:* ${new Date(data.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : '';

    const priorityEmoji =
      data.priority === 'URGENT' ? '🚨' : data.priority === 'HIGH' ? '🔥' : data.priority === 'MEDIUM' ? '⚡' : '☕';

    const text =
      `📌 *New Task Created in ${data.workspaceName}*\n\n` +
      `📝 *Task:* *${data.taskTitle}*\n` +
      `${priorityEmoji} *Priority:* \`${data.priority}\`\n` +
      `👤 *Assigned to:* ${data.assigneeName ? `*${data.assigneeName}*` : '_Unassigned_'}\n` +
      `👑 *Created by:* *${data.creatorName}*${dueInfo}\n\n` +
      `_This task has been synchronized to your team's group board._`;

    const inlineKeyboard: any[] = [
      [
        { text: '✅ Mark Done', callback_data: `task:done:${data.taskId}` },
        { text: '🔍 View Details', callback_data: `task:view:${data.taskId}` },
      ],
      [{ text: '📱 Open Group Board in Mini App', url: webAppUrl }],
    ];

    return this.sendTelegramMessage(data.groupChatId, text, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }

  async notifyGroupTaskCompleted(data: {
    groupChatId: string;
    taskTitle: string;
    workspaceName: string;
    completedByName: string;
  }) {
    const webAppUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://localhost:3000';
    const text =
      `🎉 *Task Completed in ${data.workspaceName}!*\n\n` +
      `✅ *${data.completedByName}* completed: *"${data.taskTitle}"*`;

    return this.sendTelegramMessage(data.groupChatId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📱 Open Group Board', url: webAppUrl }],
        ],
      },
    });
  }
}
