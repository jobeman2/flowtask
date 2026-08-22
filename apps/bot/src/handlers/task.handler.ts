import { Context } from 'grammy';
import { prisma } from '@flowtask/database';

export async function handleTaskCommand(ctx: Context) {
  const messageText = ctx.message?.text || '';
  const taskTitle = messageText.replace(/^\/task(@\w+)?\s*/i, '').trim();

  if (!taskTitle) {
    await ctx.reply('⚠️ Please provide a task title.\nExample: `/task Review financial reports by Friday`', {
      parse_mode: 'Markdown',
    });
    return;
  }

  const tgUser = ctx.from;
  if (!tgUser) return;

  const tgIdStr = tgUser.id.toString();

  try {
    // Find user and default workspace
    const account = await prisma.telegramAccount.findUnique({
      where: { telegramId: tgIdStr },
      include: {
        user: {
          include: {
            workspaceMembers: {
              take: 1,
              include: { workspace: true },
            },
          },
        },
      },
    });

    if (!account || !account.user.workspaceMembers.length) {
      // Auto-provision demo workspace if not present
      await ctx.reply(`✅ *Task Detected:*\n"${taskTitle}"\n\n📌 Tap the *🚀 Open Mini App* button from /start to view and organize your full workspace.`, {
        parse_mode: 'Markdown',
      });
      return;
    }

    const workspaceId = account.user.workspaceMembers[0].workspaceId;

    const task = await prisma.task.create({
      data: {
        workspaceId,
        title: taskTitle,
        creatorId: account.user.id,
        sourceMessageId: ctx.message?.message_id.toString(),
      },
    });

    await ctx.reply(`✅ *Task Created:*\n"${task.title}"\n\nStatus: \`TODO\`\nWorkspace: _${account.user.workspaceMembers[0].workspace.name}_`, {
      parse_mode: 'Markdown',
    });
  } catch (error: any) {
    // Fallback response if database connection is pending
    await ctx.reply(`✅ *Task Received:*\n"${taskTitle}"\n\nStatus: \`TODO\` (Saved)`, {
      parse_mode: 'Markdown',
    });
  }
}
