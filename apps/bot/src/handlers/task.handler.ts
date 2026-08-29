import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus, WorkspaceRole } from '@flowtask/database';
import { parseTaskMessage } from '../utils/rule-parser';
import { resolveGroupWorkspace } from './group.handler';
import { botConfig } from '../config/bot.config';

export async function handleTaskCommand(ctx: Context) {
  const messageText = ctx.message?.text || '';
  let rawContent = messageText.replace(/^\/(task|create|add|todo)(@\w+)?\s*/i, '').trim();

  // If used as a reply to a message with no extra text, capture the replied message
  const replyTo = ctx.message?.reply_to_message;
  let replyAssigneeUsername: string | null = null;

  if (!rawContent && replyTo && 'text' in replyTo && replyTo.text) {
    rawContent = replyTo.text.slice(0, 150);
    if (replyTo.from?.username) {
      replyAssigneeUsername = replyTo.from.username;
    }
  }

  if (!rawContent) {
    await ctx.reply(
      `📝 *Quick Task Creator*\n\n` +
      `You can type naturally with smart tags or reply to any message with \`/task\`:\n\n` +
      `• \`/task Prepare pitch deck !urgent tomorrow 5pm\`\n` +
      `• \`/task Review design @samuel +Marketing #v1 due:tomorrow\`\n` +
      `• \`/task Weekly standup every monday 10am remind:15m\`\n\n` +
      `💡 *Tags:* \`!urgent\`, \`!high\`, \`@username\`, \`+Project\`, \`#Label\`, \`every monday\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const tgUser = ctx.from;
  if (!tgUser) return;

  const parsed = parseTaskMessage(rawContent, new Date());
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

    const recurringStr = task.isRecurring ? `\n🔁 *Repeats:* \`${task.recurrenceRule}\`` : '';
    const projectStr = parsed.projectName ? `\n📁 *Project:* ${escapeMarkdown(parsed.projectName)}` : '';
    const assigneeStr = assigneeDisplayName ? `\n👤 *Assignee:* ${assigneeDisplayName}` : '';
    const workspaceHeader = isGroup ? `🏢 *Group Board:* _${escapeMarkdown(activeWorkspace.name)}_\n` : '';

    const replyText =
      `✅ *Task Created!*\n\n` +
      `${workspaceHeader}` +
      `📝 *Title:* ${escapeMarkdown(task.title)}\n` +
      `${priorityIcon} *Priority:* \`${task.priority}\`` +
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
  } catch (err: any) {
    console.error('Failed to create task:', err);
    await ctx.reply(`⚠️ Failed to create task: ${err.message}`);
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
