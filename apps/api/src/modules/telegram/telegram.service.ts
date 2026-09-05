import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceType, WorkspaceRole } from '@flowtask/database';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  verifyWebhookSecret(headerSecret: string): boolean {
    const configuredSecret = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!configuredSecret) return true; // If not configured in dev, pass
    return headerSecret === configuredSecret;
  }

  async handleUpdate(update: any) {
    this.logger.log(`Received Telegram webhook update ID: ${update?.update_id}`);
    try {
      // 1. Group membership change (bot added to group or made admin)
      if (update?.my_chat_member) {
        const myChatMember = update.my_chat_member;
        const chat = myChatMember.chat;
        const from = myChatMember.from;
        const newStatus = myChatMember.new_chat_member?.status;

        if (chat && (chat.type === 'group' || chat.type === 'supergroup')) {
          if (newStatus === 'member' || newStatus === 'administrator') {
            await this.registerOrSyncTelegramGroup(chat, from);
          }
        }
      }

      // 2. Message in group (e.g. /start, /connect, /sync or bot added via new_chat_members)
      if (update?.message) {
        const msg = update.message;
        const chat = msg.chat;
        const from = msg.from;

        if (chat && (chat.type === 'group' || chat.type === 'supergroup')) {
          const hasBot = msg.new_chat_members?.some((m: any) => m.is_bot);
          const isCommand =
            msg.text?.startsWith('/start') ||
            msg.text?.startsWith('/connect') ||
            msg.text?.startsWith('/sync') ||
            msg.text?.startsWith('/workspace');

          if (hasBot || isCommand) {
            await this.registerOrSyncTelegramGroup(chat, from);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error handling Telegram update: ${err.message}`);
    }
    return { ok: true };
  }

  private escapeMarkdown(text?: string | null): string {
    if (!text) return '';
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  private getSafeWebAppButton(label: string = '📱 Open in FlowTask Mini App') {
    const rawUrl = this.configService.get<string>('WEB_BASE_URL') || '';
    const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'flowtaskmanager_bot';
    if (rawUrl && rawUrl.startsWith('https://')) {
      return { text: label, web_app: { url: rawUrl } };
    }
    return { text: label, url: `https://t.me/${botUsername}` };
  }

  private getSafeGroupButton(label: string = '📱 Open in FlowTask Mini App') {
    const rawUrl = this.configService.get<string>('WEB_BASE_URL') || '';
    const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'flowtaskmanager_bot';
    if (rawUrl && rawUrl.startsWith('https://')) {
      return { text: label, url: rawUrl };
    }
    return { text: label, url: `https://t.me/${botUsername}` };
  }

  async sendTelegramMessage(
    telegramId: string,
    text: string,
    options?: { reply_markup?: any; parse_mode?: string }
  ) {
    if (!telegramId || !/^-?\d+$/.test(telegramId)) {
      this.logger.warn(`[TelegramService] Skipping message: target "${telegramId}" is not a valid numeric Telegram chat ID`);
      return { ok: false, error: 'invalid_chat_id' };
    }

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
        this.logger.warn(
          `Telegram sendMessage with parse_mode failed for ${telegramId}: ${data.description}. Retrying with plain text fallback...`
        );
        // Fallback without parse_mode and sanitizing buttons if URL was invalid
        const fallbackRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramId,
            text: text.replace(/[*_`\\]/g, ''),
            reply_markup: options?.reply_markup,
          }),
        });
        return await fallbackRes.json();
      }
      this.logger.log(`Telegram message sent successfully to ${telegramId}`);
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
      const cleanId = chatId.trim();
      const targetChatId =
        isNaN(Number(cleanId)) && !cleanId.startsWith('@') ? `@${cleanId}` : cleanId;
      const response = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: targetChatId }),
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

  async getChatMember(chatId: string, userId: number | string): Promise<any> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || token === 'mock_token_for_dev') {
      return null;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, user_id: Number(userId) }),
      });
      const data = await response.json();
      if (data.ok && data.result) {
        return data.result;
      }
      return null;
    } catch (err: any) {
      this.logger.error(`Error fetching chat member for ${chatId}/${userId}: ${err.message}`);
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
    if (!data.targetTelegramId || !/^-?\d+$/.test(data.targetTelegramId)) {
      this.logger.warn(`Cannot send workspace invite DM: target telegram ID "${data.targetTelegramId}" is not numeric`);
      return;
    }

    const wsName = this.escapeMarkdown(data.workspaceName);
    const inviter = this.escapeMarkdown(data.inviterName);

    const text =
      `👋 *Workspace Team Invitation!*\n\n` +
      `🏢 *Workspace:* *${wsName}*\n` +
      `🛡️ *Role:* \`${data.role}\`\n` +
      `👤 *Invited by:* *${inviter}*\n\n` +
      `Would you like to join this workspace to collaborate and receive assigned tasks?`;

    const inlineKeyboard: any[] = [
      [
        { text: '✅ Accept Invite', callback_data: `invite:accept:${data.workspaceId}:${data.memberId || 'new'}` },
        { text: '❌ Decline', callback_data: `invite:decline:${data.workspaceId}:${data.memberId || 'new'}` },
      ],
      [this.getSafeWebAppButton('📱 View in FlowTask Mini App')],
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
    if (!data.targetTelegramId || !/^-?\d+$/.test(data.targetTelegramId)) {
      this.logger.warn(`Cannot send task assigned DM: target telegram ID "${data.targetTelegramId}" is not numeric`);
      return;
    }

    const dueInfo = data.dueDate
      ? `\n⏰ *Due:* ${new Date(data.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : '';

    const priorityEmoji =
      data.priority === 'URGENT' ? '🚨' : data.priority === 'HIGH' ? '🔥' : data.priority === 'MEDIUM' ? '⚡' : '☕';

    const descInfo = data.description ? `\n📄 *Description:* _${this.escapeMarkdown(data.description)}_` : '';

    const text =
      `📬 *Telegram Inbox — Task Assigned to You!*\n\n` +
      `📝 *Task:* *${this.escapeMarkdown(data.taskTitle)}*${descInfo}\n` +
      `${priorityEmoji} *Priority:* \`${data.priority}\`\n` +
      `🏢 *Workspace:* *${this.escapeMarkdown(data.workspaceName)}*\n` +
      `👤 *Assigned by:* *${this.escapeMarkdown(data.assignerName)}*${dueInfo}\n\n` +
      `_This task is now in your FlowTask Mini App and Telegram task list._`;

    const inlineKeyboard: any[] = [
      [this.getSafeWebAppButton('📱 Open in FlowTask Mini App')],
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
    if (!data.targetTelegramId || !/^-?\d+$/.test(data.targetTelegramId)) return;

    const dueInfo = data.dueDate
      ? `\n⏰ *Due:* ${new Date(data.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : '';

    const priorityEmoji =
      data.priority === 'URGENT' ? '🚨' : data.priority === 'HIGH' ? '🔥' : data.priority === 'MEDIUM' ? '⚡' : '☕';

    const text =
      `✅ *Task Created Confirmation*\n\n` +
      `📝 *Task:* *${this.escapeMarkdown(data.taskTitle)}*\n` +
      `${priorityEmoji} *Priority:* \`${data.priority}\`\n` +
      `🏢 *Workspace:* *${this.escapeMarkdown(data.workspaceName)}*\n` +
      `👤 *Assigned to:* *${this.escapeMarkdown(data.assigneeName || 'You (Personal)')}*${dueInfo}\n\n` +
      `_You will receive updates here when this task is completed._`;

    const inlineKeyboard: any[] = [
      [this.getSafeWebAppButton('📱 View in FlowTask Mini App')],
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
    if (!data.targetTelegramId || !/^-?\d+$/.test(data.targetTelegramId)) return;

    const text =
      `🎉 *Task Completed!*\n\n` +
      `📝 *Task:* *${this.escapeMarkdown(data.taskTitle)}*\n` +
      `🏢 *Workspace:* *${this.escapeMarkdown(data.workspaceName)}*\n` +
      `✅ *Completed by:* *${this.escapeMarkdown(data.completedByName)}*\n\n` +
      `Great job! The task is now archived as done.`;

    return this.sendTelegramMessage(data.targetTelegramId, text, {
      reply_markup: {
        inline_keyboard: [
          [this.getSafeWebAppButton('📱 Open Mini App Board')],
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
    if (!data.groupChatId || !/^-?\d+$/.test(data.groupChatId)) {
      this.logger.warn(`Cannot send group task notification: groupChatId "${data.groupChatId}" is not numeric`);
      return;
    }

    const dueInfo = data.dueDate
      ? `\n⏰ *Due:* ${new Date(data.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : '';

    const priorityEmoji =
      data.priority === 'URGENT' ? '🚨' : data.priority === 'HIGH' ? '🔥' : data.priority === 'MEDIUM' ? '⚡' : '☕';

    const imageInfo = data.imageUrl ? `\n🖼️ *Image:* _Attached_` : '';

    // If assigned to a specific person, keep description in their private DM
    const isAssignedToUser = Boolean(data.assigneeName && data.assigneeName !== 'You (Personal)');
    const descInfo = !isAssignedToUser && data.description ? `\n📄 *Description:* _${this.escapeMarkdown(data.description)}_` : '';
    const privacyFootnote = isAssignedToUser
      ? `\n\n🔒 _Details & description sent privately to ${this.escapeMarkdown(data.assigneeName)} via DM._`
      : `\n\n_This task has been synchronized to your team's group board._`;

    const text =
      `📌 *New Task Created in ${this.escapeMarkdown(data.workspaceName)}*\n\n` +
      `📝 *Task:* *${this.escapeMarkdown(data.taskTitle)}*${descInfo}\n` +
      `${priorityEmoji} *Priority:* \`${data.priority}\`${imageInfo}\n` +
      `👤 *Assigned to:* ${data.assigneeName ? `*${this.escapeMarkdown(data.assigneeName)}*` : '_Unassigned_'}\n` +
      `👑 *Created by:* *${this.escapeMarkdown(data.creatorName)}*${dueInfo}` +
      `${privacyFootnote}`;

    const inlineKeyboard: any[] = [
      [{ text: '✅ Mark Done', callback_data: `task:done:${data.taskId}` }],
      [this.getSafeGroupButton('📱 Open in FlowTask Mini App')],
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
    if (!data.groupChatId || !/^-?\d+$/.test(data.groupChatId)) return;

    const text =
      `🎉 *Task Completed in ${this.escapeMarkdown(data.workspaceName)}!*\n\n` +
      `✅ *${this.escapeMarkdown(data.completedByName)}* completed: *"${this.escapeMarkdown(data.taskTitle)}"*`;

    return this.sendTelegramMessage(data.groupChatId, text, {
      reply_markup: {
        inline_keyboard: [
          [this.getSafeGroupButton('📱 Open Group Board')],
        ],
      },
    });
  }

  async registerOrSyncTelegramGroup(chat: any, fromUser: any) {
    const chatId = String(chat.id);
    const title = chat.title || 'Telegram Group';
    this.logger.log(`Registering or syncing Telegram Group: "${title}" (${chatId})`);

    // 1. Find or create User for fromUser if available
    let user: any = null;
    if (fromUser && !fromUser.is_bot) {
      const tgIdStr = String(fromUser.id);
      let account = await this.prisma.telegramAccount.findUnique({
        where: { telegramId: tgIdStr },
        include: { user: true },
      });

      if (!account && fromUser.username) {
        account = await this.prisma.telegramAccount.findFirst({
          where: { username: fromUser.username },
          include: { user: true },
        });
      }

      if (!account) {
        const displayName =
          [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') ||
          fromUser.username ||
          'Admin';
        const newUser = await this.prisma.user.create({
          data: {
            name: displayName,
            timezone: 'UTC',
          },
        });
        account = await this.prisma.telegramAccount.create({
          data: {
            telegramId: tgIdStr,
            username: fromUser.username || null,
            firstName: fromUser.first_name,
            lastName: fromUser.last_name || null,
            userId: newUser.id,
          },
          include: { user: true },
        });
        user = newUser;
      } else {
        user = account.user;
      }
    }

    // 2. Check if TelegramChat already exists
    let tgChat = await (this.prisma as any).telegramChat.findUnique({
      where: { chatId },
      include: { workspace: true },
    });

    let workspaceId: string;

    if (!tgChat) {
      let ownerId = user?.id;
      if (!ownerId) {
        const admins = await this.getChatAdministrators(chatId);
        const firstCreator =
          admins.find((a: any) => a.status === 'creator' && !a.user?.is_bot) ||
          admins.find((a: any) => !a.user?.is_bot);
        if (firstCreator?.user) {
          const adminTg = firstCreator.user;
          const adminTgId = String(adminTg.id);
          let adminAcc = await this.prisma.telegramAccount.findUnique({
            where: { telegramId: adminTgId },
            include: { user: true },
          });
          if (!adminAcc) {
            const adminName =
              [adminTg.first_name, adminTg.last_name].filter(Boolean).join(' ') ||
              adminTg.username ||
              'Group Admin';
            const newAdminUser = await this.prisma.user.create({
              data: {
                name: adminName,
                timezone: 'UTC',
              },
            });
            adminAcc = await this.prisma.telegramAccount.create({
              data: {
                telegramId: adminTgId,
                username: adminTg.username || null,
                firstName: adminTg.first_name,
                lastName: adminTg.last_name || null,
                userId: newAdminUser.id,
              },
              include: { user: true },
            });
            ownerId = newAdminUser.id;
          } else {
            ownerId = adminAcc.userId;
          }
        }
      }

      if (!ownerId) {
        this.logger.warn(`Could not determine owner for Telegram group "${title}" (${chatId})`);
        return;
      }

      const slug = `tg-${chatId.replace(/[^0-9]/g, '')}-${Date.now().toString(36)}`;
      const newWs = await this.prisma.workspace.create({
        data: {
          name: title,
          slug,
          ownerId,
          type: WorkspaceType.TEAM,
          members: {
            create: {
              userId: ownerId,
              role: WorkspaceRole.OWNER,
            },
          },
        },
      });

      tgChat = await (this.prisma as any).telegramChat.create({
        data: {
          chatId,
          title,
          type: chat.type || 'group',
          workspaceId: newWs.id,
        },
      });

      workspaceId = newWs.id;
    } else {
      workspaceId = tgChat.workspaceId;
      if (title && tgChat.title !== title) {
        await (this.prisma as any).telegramChat.update({
          where: { id: tgChat.id },
          data: { title },
        });
      }
    }

    // 3. Auto-sync administrators as members
    const admins = await this.getChatAdministrators(chatId);
    for (const item of admins) {
      const adminTg = item.user;
      if (!adminTg || adminTg.is_bot) continue;

      const adminTgId = String(adminTg.id);
      let adminAcc = await this.prisma.telegramAccount.findUnique({
        where: { telegramId: adminTgId },
        include: { user: true },
      });

      if (!adminAcc && adminTg.username) {
        adminAcc = await this.prisma.telegramAccount.findFirst({
          where: { username: adminTg.username },
          include: { user: true },
        });
      }

      let adminUserId: string;
      if (!adminAcc) {
        const adminName =
          [adminTg.first_name, adminTg.last_name].filter(Boolean).join(' ') ||
          adminTg.username ||
          'Admin';
        const newAdminUser = await this.prisma.user.create({
          data: {
            name: adminName,
            timezone: 'UTC',
          },
        });
        adminAcc = await this.prisma.telegramAccount.create({
          data: {
            telegramId: adminTgId,
            username: adminTg.username || null,
            firstName: adminTg.first_name,
            lastName: adminTg.last_name || null,
            userId: newAdminUser.id,
          },
          include: { user: true },
        });
        adminUserId = newAdminUser.id;
      } else {
        adminUserId = adminAcc.userId;
      }

      // Add to workspace if not already member
      const exists = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId, userId: adminUserId },
      });

      if (!exists) {
        const role = item.status === 'creator' ? WorkspaceRole.OWNER : WorkspaceRole.ADMIN;
        await this.prisma.workspaceMember.create({
          data: {
            workspaceId,
            userId: adminUserId,
            role,
          },
        });
      }
    }

    // 4. Send welcome confirmation to group
    const webAppUrl = this.configService.get<string>('WEB_BASE_URL') || 'https://flowtask-web-six.vercel.app';
    const welcomeText =
      `🎉 *FlowTask Connected Successfully!*\n\n` +
      `🏢 *Workspace:* *${title}*\n` +
      `🛡️ *Status:* Group administrators have been synced to the workspace team.\n\n` +
      `Team members can now open the board in the FlowTask Mini App, assign tasks, set deadlines, and receive instant alerts here!`;

    await this.sendTelegramMessage(chatId, welcomeText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Open FlowTask Board', web_app: { url: webAppUrl } }],
        ],
      },
    });
  }
}
