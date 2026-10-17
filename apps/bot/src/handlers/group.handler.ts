import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus, WorkspaceType, WorkspaceRole } from '@flowtask/database';
import { botConfig } from '../config/bot.config';

/**
 * Resolves or auto-provisions a Team Workspace for a Telegram Group.
 * If called in private chat, returns the user's primary workspace.
 */
export async function resolveGroupWorkspace(ctx: Context, tgUser?: any) {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  if (!tgUser) {
    tgUser = ctx.from || (ctx as any).senderChat || (ctx as any).myChatMember?.from || (ctx as any).chatMember?.from || { id: 'admin', first_name: 'Admin' };
  }

  const tgIdStr = (tgUser.id || ctx.chat?.id || 'admin').toString();
  const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.title || tgUser.username || (ctx.chat && 'title' in ctx.chat ? ctx.chat.title : 'User');

  // 1. Ensure user account exists
  let account = await prisma.telegramAccount.findUnique({
    where: { telegramId: tgIdStr },
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
    const user = await prisma.user.create({
      data: {
        name: displayName,
      },
    });

    account = await prisma.telegramAccount.create({
      data: {
        telegramId: tgIdStr,
        username: tgUser.username || null,
        firstName: displayName,
        lastName: tgUser.last_name || null,
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

  if (!isGroup) {
    // Private chat: return active or first workspace
    if (account.user.workspaceMembers.length > 0) {
      return account.user.workspaceMembers[0].workspace;
    }
    // Create personal workspace if none
    const newWs = await prisma.workspace.create({
      data: {
        name: `${tgUser.first_name}'s Workspace`,
        slug: `ws-${tgUser.id}-${Date.now().toString(36)}`,
        ownerId: account.userId,
        type: WorkspaceType.PERSONAL,
        members: {
          create: {
            userId: account.userId,
            role: WorkspaceRole.OWNER,
          },
        },
      },
    });
    return newWs;
  }

  // 2. Group Chat: Find or Create Team Workspace linked to this group
  const chatIdStr = ctx.chat!.id.toString();
  const groupTitle = ctx.chat && 'title' in ctx.chat ? ctx.chat.title : 'Team Group';

  let tgChat = await prisma.telegramChat.findFirst({
    where: { chatId: chatIdStr },
  });

  let groupWorkspace: any = null;

  if (tgChat && tgChat.workspaceId) {
    groupWorkspace = await prisma.workspace.findUnique({
      where: { id: tgChat.workspaceId },
    });
  }

  if (!groupWorkspace) {
    // Auto-create a Team Workspace for this Telegram Group
    const slug = `grp-${Math.abs(ctx.chat!.id).toString(36)}-${Date.now().toString(36)}`;
    groupWorkspace = await prisma.workspace.create({
      data: {
        name: `${groupTitle} Board`,
        slug,
        ownerId: account.userId,
        type: WorkspaceType.TEAM,
        members: {
          create: {
            userId: account.userId,
            role: WorkspaceRole.ADMIN,
          },
        },
      },
    });

    if (tgChat) {
      await prisma.telegramChat.update({
        where: { id: tgChat.id },
        data: { workspaceId: groupWorkspace.id, title: groupTitle },
      });
    } else {
      await prisma.telegramChat.create({
        data: {
          chatId: chatIdStr,
          workspaceId: groupWorkspace.id,
          type: ctx.chat!.type,
          title: groupTitle,
        },
      });
    }
  }

  // 3. Sender is NOT auto-added as a member. If not a member, they can request invite or be invited.
  // 4. Creators are set as owners, other administrators are invited via pending invitations
  try {
    const admins = await ctx.api.getChatAdministrators(ctx.chat!.id);
    for (const admin of admins) {
      if (admin.user.is_bot) continue;
      const adminTgId = admin.user.id.toString();
      const adminName = [admin.user.first_name, admin.user.last_name].filter(Boolean).join(' ') || admin.user.username || 'Team Member';

      let adminAcc = await prisma.telegramAccount.findUnique({
        where: { telegramId: adminTgId },
        include: { user: true },
      });

      if (!adminAcc) {
        const u = await prisma.user.create({ data: { name: adminName } });
        adminAcc = await prisma.telegramAccount.create({
          data: {
            telegramId: adminTgId,
            username: admin.user.username || null,
            firstName: admin.user.first_name,
            lastName: admin.user.last_name || null,
            userId: u.id,
          },
          include: { user: true },
        });
      }

      const existingMem = await prisma.workspaceMember.findFirst({
        where: { workspaceId: groupWorkspace.id, userId: adminAcc.userId },
      });

      if (!existingMem) {
        if (admin.status === 'creator') {
          await prisma.workspaceMember.create({
            data: {
              workspaceId: groupWorkspace.id,
              userId: adminAcc.userId,
              role: WorkspaceRole.OWNER,
            },
          });
        } else {
          // Check if pending invitation exists
          const existingInv = await (prisma as any).workspaceInvitation.findFirst({
            where: {
              workspaceId: groupWorkspace.id,
              status: 'PENDING',
              OR: [
                { inviteeUserId: adminAcc.userId },
                { targetTelegramId: adminTgId },
              ],
            },
          });

          if (!existingInv) {
            await (prisma as any).workspaceInvitation.create({
              data: {
                workspaceId: groupWorkspace.id,
                inviteeUserId: adminAcc.userId,
                targetTelegramId: adminTgId,
                targetUsername: admin.user.username ? admin.user.username.toLowerCase() : null,
                role: WorkspaceRole.ADMIN,
                status: 'PENDING',
              },
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('Could not auto-fetch group admins:', err.message);
  }

  return groupWorkspace;
}

/**
 * Handles new chat members added to a group.
 * If user has started FlowTask bot: auto-adds them to the group workspace and sends private notification.
 * If user has not started FlowTask bot: creates pending invitation so they join when opening the bot.
 */
export async function handleNewChatMembers(ctx: Context) {
  const newMembers = ctx.message?.new_chat_members || ((ctx as any).chatMember?.new_chat_member?.user ? [(ctx as any).chatMember.new_chat_member.user] : []);
  if (!newMembers || newMembers.length === 0) return;

  // Check if bot itself was added
  const botInfo = ctx.me;
  const isBotAdded = newMembers.some((m: any) => m.id === botInfo.id);
  if (isBotAdded) {
    return handleBotAddedToGroup(ctx);
  }

  const workspace = await resolveGroupWorkspace(ctx);
  if (!workspace) return;

  const addedNames: string[] = [];

  for (const member of newMembers) {
    if (member.is_bot) continue;

    const tgIdStr = member.id.toString();
    const username = member.username ? member.username.replace(/^@/, '').toLowerCase() : null;
    const displayName = [member.first_name, member.last_name].filter(Boolean).join(' ') || username || 'Team Member';

    // 1. Check if user already has an account in FlowTask (has started the bot)
    let account = await prisma.telegramAccount.findUnique({
      where: { telegramId: tgIdStr },
      include: { user: true },
    });

    if (!account && username) {
      account = await prisma.telegramAccount.findFirst({
        where: { username },
        include: { user: true },
      });
    }

    if (account) {
      // User has started the bot! Auto-add them to this group's workspace
      const isMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId: workspace.id, userId: account.userId },
      });

      if (!isMember) {
        await prisma.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: account.userId,
            role: WorkspaceRole.MEMBER,
          },
        });
        addedNames.push(displayName);

        // Send them a private notification with 1-tap webapp access
        try {
          await ctx.api.sendMessage(
            tgIdStr,
            `🎉 *You were added to the workspace team!*\n\n` +
            `🏢 *Workspace:* *${escapeMarkdown(workspace.name)}*\n` +
            `You can now view, create, and complete tasks with your teammates.`,
            {
              parse_mode: 'Markdown',
              reply_markup: new InlineKeyboard().url(
                '📱 Open Team Board',
                `${botConfig.webAppUrl}?workspaceId=${workspace.id}`
              ),
            }
          );
        } catch {}
      }
    } else {
      // User has not started the bot yet: create a pending invitation
      const existingInv = await (prisma as any).workspaceInvitation.findFirst({
        where: {
          workspaceId: workspace.id,
          status: 'PENDING',
          OR: [
            { targetTelegramId: tgIdStr },
            ...(username ? [{ targetUsername: username }] : []),
          ],
        },
      });

      if (!existingInv) {
        await (prisma as any).workspaceInvitation.create({
          data: {
            workspaceId: workspace.id,
            targetTelegramId: tgIdStr,
            targetUsername: username,
            role: WorkspaceRole.MEMBER,
            status: 'PENDING',
          },
        });
      }
    }
  }

  if (addedNames.length > 0) {
    const namesStr = addedNames.join(', ');
    await ctx.reply(
      `👋 *Welcome ${escapeMarkdown(namesStr)} to ${escapeMarkdown(workspace.name)}!*\n\n` +
      `Your account has been synced with the team's task board.`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().url('📱 Open Team Board', `${botConfig.webAppUrl}?workspaceId=${workspace.id}`),
      }
    );
  }
}

/**
 * Greets the group when the bot is added or initialized.
 */
export async function handleBotAddedToGroup(ctx: Context) {
  const tgUser = ctx.from || (ctx as any).myChatMember?.from || (ctx as any).chatMember?.from;
  if (!tgUser) return;

  const workspace = await resolveGroupWorkspace(ctx, tgUser);

  const botInfo = await ctx.api.getMe();
  const keyboard = new InlineKeyboard()
    .url('📱 Open Group Board', `${botConfig.webAppUrl}?workspaceId=${workspace.id}`)
    .row()
    .url('🔗 Link Existing Workspace', `https://t.me/${botInfo.username}?start=link_${Math.abs(ctx.chat!.id)}`)
    .row()
    .text('📋 Active Tasks', 'tasks:filter:PENDING:1')
    .text('📊 Team Summary', 'action:group_summary');

  await ctx.reply(
    `✨ *Welcome to FlowTask! Group Board Ready.*\n\n` +
    `🏢 *Board:* *${escapeMarkdown(workspace.name)}*\n\n` +
    `Collaborate with your team, assign tasks, and track progress right here in this group.\n\n` +
    `⚡️ *Quick Actions:*\n` +
    `• \`/task <title>\` — Create a new task\n` +
    `• *Reply* with \`/task\` — Convert any message to a task\n` +
    `• \`/tasks\` — View active team tasks\n` +
    `• \`/mytasks\` — View your assigned tasks\n` +
    `• \`/summary\` — Daily team standup summary\n\n` +
    `💡 _Tip: Tag teammates with @username to assign tasks instantly._\n` +
    `_Group admins can tap "Link Existing Workspace" below to connect another workspace._`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
}

/**
 * Handles /link command to link an existing workspace to this group or create a new one.
 */
export async function handleLinkGroupCommand(ctx: Context) {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  if (!isGroup) {
    return ctx.reply('Please run `/link` inside a Telegram group you want to link to a workspace.', {
      parse_mode: 'Markdown',
    });
  }

  const tgUser = ctx.from;
  if (!tgUser) return;

  // 1. Verify caller is an administrator or creator of the group
  try {
    const chatMember = await ctx.getChatMember(tgUser.id);
    const isAdmin = chatMember.status === 'creator' || chatMember.status === 'administrator';
    if (!isAdmin) {
      return ctx.reply('⚠️ Only group administrators can connect this Telegram group to a FlowTask workspace.');
    }
  } catch {
    // Non-blocking in test/mock environments
  }

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
    const botInfo = await ctx.api.getMe();
    return ctx.reply(
      `⚠️ Please start @${botInfo.username} first in private chat so you can select and link your workspaces safely.`,
      {
        reply_markup: new InlineKeyboard().url('Start Bot Privately', `https://t.me/${botInfo.username}?start=link_${Math.abs(ctx.chat.id)}`),
      }
    );
  }

  const eligibleMembers = account.user.workspaceMembers.filter(
    (m: any) => m.role === WorkspaceRole.OWNER || m.role === WorkspaceRole.ADMIN
  );

  if (eligibleMembers.length === 0) {
    return handleBotAddedToGroup(ctx);
  }

  const chatIdStr = String(ctx.chat.id);
  const groupTitle = ctx.chat && 'title' in ctx.chat ? ctx.chat.title : 'this group';

  // Build private selection keyboard
  const privateKeyboard = new InlineKeyboard();
  eligibleMembers.slice(0, 8).forEach((m: any) => {
    privateKeyboard.text(`🔗 Link "${m.workspace.name}"`, `group:link_ws:${m.workspace.id}:${chatIdStr}`).row();
  });
  privateKeyboard.text(`➕ Create New Board`, `group:link_ws:new:${chatIdStr}`).row();
  privateKeyboard.url('📱 Open Mini App', `${botConfig.webAppUrl}?action=link_group&chatId=${chatIdStr}`);

  let sentPrivate = false;
  try {
    await ctx.api.sendMessage(
      tgUser.id,
      `🔒 *Connect Telegram Group to FlowTask*\n\n` +
      `Choose which workspace you want to connect to *${escapeMarkdown(groupTitle)}*:\n\n` +
      `_Only you can see this selection to protect your workspace privacy._`,
      {
        parse_mode: 'Markdown',
        reply_markup: privateKeyboard,
      }
    );
    sentPrivate = true;
  } catch {
    // User hasn't PM'd the bot yet
  }

  const botInfo = await ctx.api.getMe();
  const groupKeyboard = new InlineKeyboard();
  if (sentPrivate) {
    groupKeyboard.url('📩 Choose Workspace in Private Chat', `https://t.me/${botInfo.username}`).row();
  } else {
    groupKeyboard.url('📩 Choose Workspace Privately', `https://t.me/${botInfo.username}?start=link_${Math.abs(ctx.chat.id)}`).row();
  }
  groupKeyboard.url('📱 Connect via Mini App', `${botConfig.webAppUrl}?action=link_group&chatId=${chatIdStr}`);

  await ctx.reply(
    `🔒 *Connect Telegram Group to FlowTask*\n\n` +
    (sentPrivate
      ? `To protect your privacy, workspace options were sent privately to @${tgUser.username || tgUser.first_name}.\n\nOther group members will only see the linked board once connected.`
      : `To keep your workspace names private from other group members, please tap below to select your workspace in private chat or via the Mini App:`),
    {
      parse_mode: 'Markdown',
      reply_markup: groupKeyboard,
    }
  );
}

/**
 * Shows group information and task metrics.
 */
export async function handleGroupInfo(ctx: Context) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const workspace = await resolveGroupWorkspace(ctx, tgUser);
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    include: { user: true },
  });

  const pendingTasks = await prisma.task.count({
    where: { workspaceId: workspace.id, status: { not: TaskStatus.DONE }, archivedAt: null },
  });

  const completedTasks = await prisma.task.count({
    where: { workspaceId: workspace.id, status: TaskStatus.DONE },
  });

  const keyboard = new InlineKeyboard()
    .url('📱 Open Group Mini App', botConfig.webAppUrl)
    .row()
    .text('📋 View Tasks', 'tasks:filter:PENDING:1');

  await ctx.reply(
    `🏢 *Group Workspace:* *${escapeMarkdown(workspace.name)}*\n\n` +
    `👥 *Team Members:* ${members.length}\n` +
    `⏳ *Active Tasks:* ${pendingTasks}\n` +
    `✅ *Completed Tasks:* ${completedTasks}\n\n` +
    `_Use \`/task <title>\` to add action items for your team!_`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
}

/**
 * Generates a standup / workload summary for the group.
 */
export async function handleGroupSummary(ctx: Context) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const workspace = await resolveGroupWorkspace(ctx, tgUser);

  const activeTasks = await prisma.task.findMany({
    where: {
      workspaceId: workspace.id,
      status: { not: TaskStatus.DONE },
      archivedAt: null,
    },
    include: {
      assignee: true,
      creator: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  if (activeTasks.length === 0) {
    const keyboard = new InlineKeyboard().url('📱 Open Mini App', botConfig.webAppUrl);
    await ctx.reply(
      `📊 *Group Task Summary — ${escapeMarkdown(workspace.name)}*\n\n` +
      `🎉 *Zero pending tasks!* Everything is done.\n\n` +
      `_Type \`/task <title>\` to create a new action item._`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
    return;
  }

  let text = `📊 *Group Standup & Task Summary*\n` +
    `🏢 *${escapeMarkdown(workspace.name)}* (${activeTasks.length} active tasks)\n\n`;

  const keyboard = new InlineKeyboard();

  activeTasks.forEach((task: any, index: number) => {
    const priorityIcon =
      task.priority === 'URGENT' ? '🚨' : task.priority === 'HIGH' ? '🔥' : task.priority === 'MEDIUM' ? '⚡' : '☕';
    const assigneeStr = task.assignee?.name ? ` • 👤 *${task.assignee.name}*` : ' • 👤 _Unassigned_';
    const dueStr = task.dueDate ? ` • ⏰ ${new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : '';

    text += `${index + 1}\\. ${priorityIcon} *${escapeMarkdown(task.title)}*${assigneeStr}${dueStr}\n`;

    if (index < 5) {
      keyboard.text(`✅ #${index + 1}`, `task:done:${task.id}`);
    }
  });

  keyboard.row().url('📱 Open Group Board in Mini App', botConfig.webAppUrl);

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
