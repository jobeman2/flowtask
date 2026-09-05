import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus, WorkspaceRole } from '@flowtask/database';
import { parseTaskMessage } from '../utils/rule-parser';
import { resolveGroupWorkspace } from './group.handler';
import { botConfig } from '../config/bot.config';

export async function handleTaskCommand(ctx: Context) {
  const messageText = ctx.message?.text || ctx.message?.caption || '';
  let rawContent = messageText.replace(/^\/(task|create|add|todo)(@\w+)?\s*/i, '').trim();

  // If used as a reply to a message with no extra text, capture the replied message
  const replyTo = ctx.message?.reply_to_message;
  let replyAssigneeUsername: string | null = null;
  let photoFileId: string | null = null;
  let docFileName: string | null = null;
  let isVoiceNote = false;

  // 1. Check if message itself has a photo
  if (ctx.message?.photo && ctx.message.photo.length > 0) {
    const photos = ctx.message.photo;
    photoFileId = photos[photos.length - 1].file_id;
  } else if (replyTo && 'photo' in replyTo && Array.isArray(replyTo.photo) && replyTo.photo.length > 0) {
    const photos = replyTo.photo;
    photoFileId = photos[photos.length - 1].file_id;
  }

  // 2. Check if message has document
  if (ctx.message?.document) {
    docFileName = ctx.message.document.file_name || 'Attached Document';
  } else if (replyTo && 'document' in replyTo && replyTo.document) {
    docFileName = replyTo.document.file_name || 'Attached Document';
  }

  // 3. Check if message has voice note
  if (ctx.message?.voice || (replyTo && 'voice' in replyTo && replyTo.voice)) {
    isVoiceNote = true;
  }

  if (!rawContent && replyTo) {
    if ('text' in replyTo && replyTo.text) {
      rawContent = replyTo.text.slice(0, 150);
    } else if ('caption' in replyTo && replyTo.caption) {
      rawContent = replyTo.caption.slice(0, 150);
    } else if (photoFileId) {
      rawContent = 'Attached Image Task';
    } else if (docFileName) {
      rawContent = `Review: ${docFileName}`;
    } else if (isVoiceNote) {
      rawContent = 'Voice Memo Task';
    }
    if (replyTo.from?.username) {
      replyAssigneeUsername = replyTo.from.username;
    }
  }

  if (!rawContent && !photoFileId && !docFileName && !isVoiceNote) {
    await ctx.reply(
      `📝 *Quick Task Creator & Media Attachments*\n\n` +
      `You can type naturally with smart tags, attach photos/files, or reply to any Telegram file with \`/task\`:\n\n` +
      `• \`/task Prepare pitch deck !urgent tomorrow 5pm\`\n` +
      `• \`/task Review design @samuel +Marketing #v1 due:tomorrow\`\n` +
      `• \`[Send Photo with caption]\` \`/task Inspect mockup !high\`\n` +
      `• \`[Send PDF/Document]\` \`/task Review agreement @legal\`\n` +
      `• \`/task Weekly standup every monday 10am remind:15m\`\n\n` +
      `💡 *Tags:* \`!urgent\`, \`!high\`, \`@username\`, \`+Project\`, \`#Label\`, \`every monday\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const tgUser = ctx.from;
  if (!tgUser) return;

  // Resolve photo URL from Telegram API if photo is attached
  let imageUrl: string | undefined;
  if (photoFileId) {
    try {
      const file = await ctx.api.getFile(photoFileId);
      if (file.file_path) {
        imageUrl = `https://api.telegram.org/file/bot${botConfig.token}/${file.file_path}`;
      }
    } catch (err: any) {
      console.warn('Could not resolve Telegram photo file:', err.message);
    }
  }

  const parsed = parseTaskMessage(rawContent || 'Attached Media Task', new Date());
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  try {
    // 1. Resolve or create user & workspace (handles both Group and Personal chats)
    const activeWorkspace = await resolveGroupWorkspace(ctx, tgUser);

    const account = await prisma.telegramAccount.findUnique({
      where: { telegramId: tgUser.id.toString() },
    });

    const creatorUserId = account ? account.userId : 'demo-user-1';

    // 2. Resolve Assignee (@username or replied user)
    let assigneeId: string | undefined;
    let assigneeDisplayName: string | undefined;

    const targetUsername = parsed.assigneeUsername ? parsed.assigneeUsername.replace(/^@/, '') : replyAssigneeUsername;

    if (targetUsername) {
      let targetTg = await prisma.telegramAccount.findFirst({
        where: { username: targetUsername },
      });

      let targetUserId: string;

      if (targetTg) {
        targetUserId = targetTg.userId;
      } else {
        const newUser = await prisma.user.create({
          data: { name: `@${targetUsername}` },
        });
        await prisma.telegramAccount.create({
          data: {
            username: targetUsername,
            userId: newUser.id,
          },
        });
        targetUserId = newUser.id;
      }

      // Ensure assignee is in the workspace
      const isMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId: activeWorkspace.id, userId: targetUserId },
      });

      if (!isMember) {
        await prisma.workspaceMember.create({
          data: {
            workspaceId: activeWorkspace.id,
            userId: targetUserId,
            role: WorkspaceRole.MEMBER,
          },
        });
      }

      assigneeId = targetUserId;
      assigneeDisplayName = `@${targetUsername}`;
    }

    // 3. Resolve Project if tagged (+Project)
    let projectId: string | undefined;
    if (parsed.projectName) {
      let project = await prisma.project.findFirst({
        where: {
          workspaceId: activeWorkspace.id,
          name: { equals: parsed.projectName, mode: 'insensitive' },
        },
      });

      if (!project) {
        project = await prisma.project.create({
          data: {
            workspaceId: activeWorkspace.id,
            name: parsed.projectName,
          },
        });
      }
      projectId = project.id;
    }

    // 4. Create Task
    const task = await prisma.task.create({
      data: {
        workspaceId: activeWorkspace.id,
        projectId,
        title: parsed.title,
        priority: parsed.priority,
        status: TaskStatus.TODO,
        imageUrl: imageUrl || null,
        dueDate: parsed.dueDate,
        isRecurring: parsed.isRecurring,
        recurrenceRule: parsed.recurrenceRule,
        creatorId: creatorUserId,
        assigneeId: assigneeId || (isGroup ? undefined : creatorUserId),
        sourceMessageId: ctx.message?.message_id.toString(),
      },
    });

    // 5. Create Labels if tagged (#tag)
    for (const labelName of parsed.labels) {
      let label = await prisma.label.findFirst({
        where: {
          workspaceId: activeWorkspace.id,
          name: { equals: labelName, mode: 'insensitive' },
        },
      });

      if (!label) {
        label = await prisma.label.create({
          data: {
            workspaceId: activeWorkspace.id,
            name: labelName,
          },
        });
      }

      await prisma.taskLabel.create({
        data: {
          taskId: task.id,
          labelId: label.id,
        },
      });
    }

    // 6. Format Response Message
    const priorityIcon =
      task.priority === 'URGENT' ? '🚨' : task.priority === 'HIGH' ? '🔥' : task.priority === 'MEDIUM' ? '⚡' : '☕';

    const dueStr = task.dueDate
      ? `\n⏰ *Due:* ${new Date(task.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : '';

    const imageStr = task.imageUrl ? `\n🖼️ *Image:* _Attached_` : '';
    const docStr = docFileName ? `\n📎 *Document:* \`${escapeMarkdown(docFileName)}\`` : '';
    const voiceStr = isVoiceNote ? `\n🎙️ *Voice Memo:* _Attached_` : '';
    const descStr = task.description ? `\n📄 *Description:* _${escapeMarkdown(task.description)}_` : '';
    const recurringStr = task.isRecurring ? `\n🔁 *Repeats:* \`${task.recurrenceRule}\`` : '';
    const projectStr = parsed.projectName ? `\n📁 *Project:* ${escapeMarkdown(parsed.projectName)}` : '';
    const assigneeStr = assigneeDisplayName ? `\n👤 *Assignee:* ${assigneeDisplayName}` : '';
    const workspaceHeader = isGroup ? `🏢 *Group Board:* _${escapeMarkdown(activeWorkspace.name)}_\n` : '';

    const replyText =
      `✅ *Task Created!*\n\n` +
      `${workspaceHeader}` +
      `📝 *Title:* ${escapeMarkdown(task.title)}` +
      `${descStr}\n` +
      `${priorityIcon} *Priority:* \`${task.priority}\`` +
      `${imageStr}` +
      `${docStr}` +
      `${voiceStr}` +
      `${assigneeStr}` +
      `${dueStr}` +
      `${projectStr}` +
      `${recurringStr}`;

    const keyboard = new InlineKeyboard()
      .text('✅ Mark Done', `task:done:${task.id}`)
      .text('🔍 Details', `task:view:${task.id}`)
      .row();

    if (isGroup) {
      keyboard.url('📱 Open Board in Mini App', botConfig.webAppUrl);
    } else {
      keyboard.webApp('📱 Open Board in Mini App', botConfig.webAppUrl);
    }

    await ctx.reply(replyText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    // 7. Dispatch private DM to assignee if assigned to someone else
    if (assigneeId && assigneeId !== creatorUserId) {
      try {
        let targetAcc = await prisma.telegramAccount.findFirst({
          where: { userId: assigneeId },
        });

        if ((!targetAcc?.telegramId || !/^\d+$/.test(targetAcc.telegramId)) && targetUsername) {
          const altTg = await prisma.telegramAccount.findFirst({ where: { username: targetUsername } });
          if (altTg?.telegramId && /^\d+$/.test(altTg.telegramId)) {
            targetAcc = altTg;
          }
        }

        if (targetAcc?.telegramId && /^\d+$/.test(targetAcc.telegramId)) {
          const appUrl = botConfig.webAppUrl.startsWith('https://') ? botConfig.webAppUrl : 'https://flowtask.app';
          const dmKeyboard = new InlineKeyboard()
            .text('✅ Mark Done', `task:done:${task.id}`)
            .text('🔍 Details', `task:view:${task.id}`)
            .row()
            .url('📱 Open in FlowTask Mini App', appUrl);

          const creatorDisplayName = tgUser.first_name || tgUser.username || 'A teammate';

          await ctx.api.sendMessage(
            targetAcc.telegramId,
            `📬 *Telegram Inbox — Task Assigned to You!*\n\n` +
            `📝 *Task:* *${task.title}*${task.description ? `\n📄 *Description:* _${task.description}_` : ''}\n` +
            `${priorityIcon} *Priority:* \`${task.priority}\`\n` +
            `🏢 *Workspace:* *${activeWorkspace.name}*\n` +
            `👤 *Assigned by:* *${creatorDisplayName}*${dueStr}\n\n` +
            `_You can manage and mark this task as done here or in the Mini App._`,
            { parse_mode: 'Markdown', reply_markup: dmKeyboard }
          );
        }
      } catch (dmErr: any) {
        console.warn(`Could not dispatch assignee DM:`, dmErr.message);
      }
    }

    // 8. If task created in private chat but workspace is linked to a group chat, broadcast to the group
    if (!isGroup) {
      try {
        const groupChat = await prisma.telegramChat.findFirst({
          where: { workspaceId: activeWorkspace.id },
        });
        if (groupChat?.chatId && /^-?\d+$/.test(groupChat.chatId)) {
          const appUrl = botConfig.webAppUrl.startsWith('https://') ? botConfig.webAppUrl : 'https://flowtask.app';
          const groupKeyboard = new InlineKeyboard()
            .text('✅ Mark Done', `task:done:${task.id}`)
            .row()
            .url('📱 Open in FlowTask Mini App', appUrl);

          await ctx.api.sendMessage(
            groupChat.chatId,
            `📌 *New Task Created in ${activeWorkspace.name}*\n\n` +
            `📝 *Task:* *${task.title}*${task.description ? `\n📄 *Description:* _${task.description}_` : ''}\n` +
            `${priorityIcon} *Priority:* \`${task.priority}\`\n` +
            `👤 *Assigned to:* ${assigneeDisplayName || '_Unassigned_'}\n` +
            `👑 *Created by:* *${tgUser.first_name || tgUser.username || 'A teammate'}*${dueStr}\n\n` +
            `_This task has been synchronized to your team's group board._`,
            { parse_mode: 'Markdown', reply_markup: groupKeyboard }
          );
        }
      } catch (grpErr: any) {
        console.warn('Could not broadcast task to group:', grpErr.message);
      }
    }
  } catch (err: any) {
    console.error('Failed to create task:', err);
    await ctx.reply(`⚠️ Failed to create task: ${err.message}`);
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
