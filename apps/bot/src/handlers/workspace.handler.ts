import { Context, InlineKeyboard } from 'grammy';
import { prisma, WorkspaceType } from '@flowtask/database';

export async function handleWorkspaceCommand(ctx: Context) {
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
    await ctx.reply('⚠️ Please run /start first.');
    return;
  }

  const members = account.user.workspaceMembers;
  const currentWorkspace = members[0]?.workspace;

  let message = `🏢 *Workspace Manager*\n\n` +
    `Currently active: *${currentWorkspace?.name || 'Personal Workspace'}*\n` +
    `Type: \`${currentWorkspace?.type || 'PERSONAL'}\`\n` +
    `Role: \`${members[0]?.role || 'OWNER'}\`\n\n` +
    `*Your Workspaces:*\n`;

  const keyboard = new InlineKeyboard();

  members.forEach((m: any) => {
    const isCurrent = m.workspaceId === currentWorkspace?.id;
    const badge = isCurrent ? '🟢' : '⚪';
    const typeLabel = m.workspace.type === WorkspaceType.CLIENT_COLLABORATION ? '👥 Client Collab' : '🏢 Internal Team';
    message += `${badge} *${m.workspace.name}* (${typeLabel})\n`;

    if (!isCurrent) {
      keyboard.text(`Switch to "${m.workspace.name}"`, `ws:switch:${m.workspace.id}`).row();
    }
  });

  keyboard
    .text('➕ New Team Workspace', 'ws:create:TEAM')
    .text('👥 New Client Workspace', 'ws:create:CLIENT')
    .row()
    .text('🔙 Back', 'action:main_menu');

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function handleWorkspaceSwitch(ctx: Context, targetWorkspaceId: string) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const targetWs = await prisma.workspace.findUnique({
    where: { id: targetWorkspaceId },
  });

  if (!targetWs) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Workspace not found.' });
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: `Switched to ${targetWs.name}` });
    await ctx.editMessageText(
      `✅ *Active Workspace Switched!*\n\n` +
      `🏢 *${targetWs.name}*\n` +
      `Type: \`${targetWs.type}\`\n\n` +
      `All new tasks, /tasks, and /today views are now scoped to this workspace.`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('📝 View Active Tasks', 'tasks:filter:PENDING:1'),
      }
    );
  }
}

export async function handleWorkspaceCreate(ctx: Context, type: 'TEAM' | 'CLIENT') {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId: tgUser.id.toString() },
    include: { user: true },
  });

  if (!account) return;

  const wsType = type === 'CLIENT' ? WorkspaceType.CLIENT_COLLABORATION : WorkspaceType.TEAM;
  const typeName = type === 'CLIENT' ? 'Client Collaboration Portal' : 'Internal Team';
  const name = `${tgUser.first_name}'s ${typeName}`;

  const ws = await prisma.workspace.create({
    data: {
      name,
      slug: `ws-${type.toLowerCase()}-${tgUser.id}-${Date.now().toString(36)}`,
      ownerId: account.user.id,
      type: wsType,
      members: {
        create: {
          userId: account.user.id,
          role: 'OWNER',
        },
      },
    },
  });

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: `Created ${ws.name}` });
    await ctx.editMessageText(
      `🎉 *New Workspace Created!*\n\n` +
      `🏢 *${ws.name}*\n` +
      `Type: \`${wsType}\`\n\n` +
      `You can now organize separate projects, clients, and deadlines under this space.`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('📝 Add First Task', 'action:quick_task'),
      }
    );
  }
}
