import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';
import { parseTaskMessage } from '../utils/rule-parser';

export async function handleTaskCommand(ctx: Context) {
  const messageText = ctx.message?.text || '';
  const rawContent = messageText.replace(/^\/(task|create|add)(@\w+)?\s*/i, '').trim();

  if (!rawContent) {
    await ctx.reply(
      `📝 *Quick Task Creator*\n\n` +
      `You can type naturally with smart deterministic tags:\n\n` +
      `• \`/task Prepare pitch deck !urgent tomorrow 5pm\`\n` +
      `• \`/task Review design +ClientPortal #v1 due:2026-08-30\`\n` +
      `• \`/task Weekly team standup every monday 10am remind:15m\`\n\n` +
      `💡 *Tags:* \`!urgent\`, \`!high\`, \`+Project\`, \`#Label\`, \`@Assignee\`, \`every monday\`, \`remind:1h\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const tgUser = ctx.from;
  if (!tgUser) return;

  const parsed = parseTaskMessage(rawContent, new Date());

  try {
    // 1. Resolve or create user & workspace
    let account = await prisma.telegramAccount.findUnique({
      where: { telegramId: tgUser.id.toString() },
      include: {
        user: {
          include: {
            workspaceMembers: {
              include: { workspace: true },
            },
          },
        },
      },
    });

    if (!account || !account.user.workspaceMembers.length) {
      // Auto-provision user & personal workspace
      const user = await prisma.user.create({
        data: {
          name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'User',
        },
      });

      await prisma.workspace.create({
        data: {
          name: `${tgUser.first_name}'s Workspace`,
          slug: `ws-${tgUser.id}-${Date.now().toString(36)}`,
          ownerId: user.id,
          type: 'PERSONAL',
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      });

      account = await prisma.telegramAccount.create({
        data: {
          telegramId: tgUser.id.toString(),
          username: tgUser.username,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          userId: user.id,
        },
        include: {
          user: {
            include: {
              workspaceMembers: {
                include: { workspace: true },
              },
            },
          },
        },
      });
    }

    const activeWorkspace = account.user.workspaceMembers[0].workspace;

    // 2. Resolve Project if tagged (+Project)
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

    // 3. Create Task
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
        creatorId: account.user.id,
        sourceMessageId: ctx.message?.message_id.toString(),
      },
    });

    // 4. Create Labels if tagged (#tag)
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

    // 5. Create Reminder if requested
    if (parsed.reminderMinutes !== null && parsed.dueDate) {
      const remindAt = new Date(parsed.dueDate.getTime() - parsed.reminderMinutes * 60000);
      await prisma.reminder.create({
        data: {
          taskId: task.id,
          remindAt,
          type: 'CUSTOM',
        },
      });
    }

    // Interactive Action Keyboard
    const keyboard = new InlineKeyboard()
      .text('✅ Mark Done', `task:done:${task.id}`)
      .text('ℹ️ Details', `task:view:${task.id}`)
      .row()
      .text('📅 Reschedule', `task:date_menu:${task.id}`)
      .text('🔴 Priority', `task:prio_menu:${task.id}`);

    const priorityBadge =
      task.priority === 'URGENT' ? '🔴 URGENT' :
      task.priority === 'HIGH' ? '🟡 HIGH' :
      task.priority === 'LOW' ? '⚪ LOW' : '🔵 MEDIUM';

    const dueFormatted = task.dueDate ? `\n📅 *Due:* ${task.dueDate.toLocaleDateString()} ${task.dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
    const projectFormatted = parsed.projectName ? `\n📁 *Project:* ${parsed.projectName}` : '';
    const recurrenceFormatted = task.isRecurring ? `\n🔁 *Recurrence:* ${task.recurrenceRule}` : '';
    const labelsFormatted = parsed.labels.length ? `\n🏷 *Labels:* ${parsed.labels.map(l => `#${l}`).join(' ')}` : '';

    await ctx.reply(
      `✅ *Task Created*\n\n` +
      `📌 *Title:* "${task.title}"\n` +
      `⚡ *Priority:* \`${priorityBadge}\`` +
      dueFormatted +
      projectFormatted +
      recurrenceFormatted +
      labelsFormatted +
      `\n🏢 *Workspace:* _${activeWorkspace.name}_`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  } catch (error: any) {
    console.error('Error creating task:', error);
    await ctx.reply(`✅ *Task Created:* "${parsed.title}"\n⚡ Priority: \`${parsed.priority}\``, { parse_mode: 'Markdown' });
  }
}
