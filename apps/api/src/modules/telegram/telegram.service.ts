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

  async sendTelegramPhoto(
    chatId: string,
    photoUrlOrFileId: string,
    caption: string,
    options?: { reply_markup?: any; parse_mode?: string }
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || token === 'mock_token_for_dev') {
      this.logger.log(`[Mock Bot Photo to ${chatId}]: ${caption}`);
      return { ok: true, mock: true };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrlOrFileId,
          caption,
          parse_mode: options?.parse_mode || 'Markdown',
          reply_markup: options?.reply_markup,
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        this.logger.warn(`Failed to send Telegram photo to ${chatId}: ${data.description}, falling back to text`);
        return this.sendTelegramMessage(chatId, caption, options);
      }
      return data;
    } catch (err: any) {
      this.logger.error(`Error sending Telegram photo to ${chatId}: ${err.message}, falling back to text`);
      return this.sendTelegramMessage(chatId, caption, options);
    }
  }

  async getUserProfilePhotoUrl(telegramId: string): Promise<string | null> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || token === 'mock_token_for_dev') return null;

    try {
      const parsedId = parseInt(telegramId, 10);
      if (isNaN(parsedId)) return null;

      const photosRes = await fetch(`https://api.telegram.org/bot${token}/getUserProfilePhotos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parsedId, limit: 1 }),
      });
      const photosData = await photosRes.json();
      if (photosData.ok && photosData.result?.total_count > 0 && photosData.result.photos?.[0]?.length > 0) {
        const photoArr = photosData.result.photos[0];
        const largestPhoto = photoArr[photoArr.length - 1];
        const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: largestPhoto.file_id }),
        });
        const fileData = await fileRes.json();
        if (fileData.ok && fileData.result?.file_path) {
          return `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
        }
      }
      return null;
    } catch (err: any) {
      this.logger.warn(`Could not fetch Telegram profile photo for ${telegramId}: ${err.message}`);
      return null;
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
    workspaceId: string;
    workspaceName: string;
    role: string;
    inviterName: string;
    memberId?: string;
  }) {
    if (!data.targetTelegramId) return;

    const webAppUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://localhost:3000';
    const text =
      `👋 *Workspace Team Invitation!*\n\n` +
      `🏢 *Workspace:* *${data.workspaceName}*\n` +
      `🛡️ *Role:* \`${data.role}\`\n` +
      `👤 *Invited by:* *${data.inviterName}*\n\n` +
      `Would you like to join this workspace to collaborate and receive assigned tasks?`;

    const inlineKeyboard: any[] = [
      [
        { text: '✅ Accept Invite', callback_data: `invite:accept:${data.workspaceId}:${data.memberId || 'new'}` },
        { text: '❌ Decline', callback_data: `invite:decline:${data.workspaceId}:${data.memberId || 'new'}` },
      ],
      [{ text: '📱 View in FlowTask Mini App', web_app: { url: webAppUrl } }],
    ];

    return this.sendTelegramMessage(data.targetTelegramId, text, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }

  async notifyTaskAssigned(data: {
    targetTelegramId?: string;
    taskId?: string;
    taskTitle: string;
    description?: string | null;
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

    const descInfo = data.description ? `\n📄 *Description:* _${data.description}_` : '';

    const text =
      `📬 *Telegram Inbox — Task Assigned to You!*\n\n` +
      `📝 *Task:* *${data.taskTitle}*${descInfo}\n` +
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
    description?: string | null;
    priority: string;
    workspaceName: string;
    creatorName: string;
    assigneeName?: string | null;
    dueDate?: string | null;
    imageUrl?: string | null;
  }) {
    const webAppUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://localhost:3000';
    const dueInfo = data.dueDate
      ? `\n⏰ *Due:* ${new Date(data.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : '';

    const priorityEmoji =
      data.priority === 'URGENT' ? '🚨' : data.priority === 'HIGH' ? '🔥' : data.priority === 'MEDIUM' ? '⚡' : '☕';

    const imageInfo = data.imageUrl ? `\n🖼️ *Image:* _Attached_` : '';
    const descInfo = data.description ? `\n📄 *Description:* _${data.description}_` : '';

    const text =
      `📌 *New Task Created in ${data.workspaceName}*\n\n` +
      `📝 *Task:* *${data.taskTitle}*${descInfo}\n` +
      `${priorityEmoji} *Priority:* \`${data.priority}\`${imageInfo}\n` +
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

    if (data.imageUrl && !data.imageUrl.startsWith('data:')) {
      return this.sendTelegramPhoto(data.groupChatId, data.imageUrl, text, {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      });
    }

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
