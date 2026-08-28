import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';
import { botConfig } from '../config/bot.config';

export async function handleTeamCommand(ctx: Context) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const account = await prisma.telegramAccount.findUnique({
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

  if (!account) {
    await ctx.reply('⚠️ Please run /start first to connect your account.');
    return;
  }

  const currentMember = account.user.workspaceMembers[0];
  const workspaceId = currentMember?.workspaceId;

  if (!workspaceId) {
    await ctx.reply('⚠️ No active workspace found. Please run /workspace to select one.');
    return;
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: true },
  });

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      status: { not: TaskStatus.DONE },
      archivedAt: null,
    },
  });

  let message = `👥 *Team Workspace: ${workspace?.name || 'My Team'}*\n` +
    `Type: \`${workspace?.type || 'TEAM'}\` • ${members.length} member(s)\n\n` +
    `*Team Roster:*\n`;

  members.forEach((m: any) => {
    const u = m.user || { name: 'Member', id: m.userId };
    const memberTasks = tasks.filter((t: any) => t.assigneeId === u.id);
    const roleIcon = m.role === 'OWNER' ? '👑' : m.role === 'ADMIN' ? '🛡️' : '👤';
    const isSelf = u.id === account.user.id ? ' _(You)_' : '';

    message += `${roleIcon} *${u.name}*${isSelf} — \`${m.role}\`\n`;
    message += `   └ 📌 ${memberTasks.length} active assigned task(s)\n`;
  });

  message += `\n💡 *Tip:* To assign a task to a teammate, write:\n` +
    `\`/task Prepare audit report !high @username\``;

  const keyboard = new InlineKeyboard();
  if (botConfig.webAppUrl) {
    keyboard.webApp('👥 Manage Team in Mini App', botConfig.webAppUrl).row();
  }
  keyboard
    .text('➕ Create Team Task', 'action:quick_task')
    .text('🏢 Switch Workspace', 'action:workspace_menu');

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
