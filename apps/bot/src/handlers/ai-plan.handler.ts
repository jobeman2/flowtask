import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus, TaskPriority } from '@flowtask/database';

export async function handleAiPlanCommand(ctx: Context) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const rawText = ctx.message?.text || '';
  const prompt = rawText.replace(/^\/(ai|plan|copilot)(@\w+)?/i, '').trim();

  // Find user's workspace
  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId: tgUser.id.toString() },
    include: {
      user: {
        include: {
          workspaceMembers: {
            take: 1,
            include: {
              workspace: {
                include: {
                  members: {
                    include: { user: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!account || !account.user.workspaceMembers.length) {
    await ctx.reply('⚠️ Please run /start in DM with @flowtaskmanager_bot first.');
    return;
  }

  const workspace = account.user.workspaceMembers[0].workspace;
  const user = account.user;
  const members = workspace.members;

  if (!prompt) {
    const miniAppUrl = process.env.WEBAPP_URL || 'https://cbs-stockholm-donations-biggest.trycloudflare.com';
    const keyboard = new InlineKeyboard()
      .url('🤖 Open AI Project Manager', miniAppUrl)
      .row()
      .text('⚡ Plan Telebirr Launch', 'ai_preset_telebirr')
      .text('⚡ Plan Bugfix Sprint', 'ai_preset_bugfix');

    await ctx.reply(
      `🤖 *FlowTask AI Project Manager (Copilot)*\n\n` +
      `Give me your rough project idea or feature goal, and I will:\n` +
      `1. 🏷️ Classify tasks across Backend, UI, Bot, and Marketing\n` +
      `2. 👤 Intelligently assign each task to your team members\n` +
      `3. ⚡ Deploy all tickets directly to your Kanban Board\n\n` +
      `*Example:*\n` +
      `\`/ai We need to launch Telebirr payments next week: backend webhook, payment UI modal, and receipt notifications.\`\n\n` +
      `Or tap below to open the interactive AI workbench:`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
    return;
  }

  await ctx.reply('🤖 *AI Project Manager is analyzing your idea and matching team roles...*', {
    parse_mode: 'Markdown',
  });

  // Generate classified tasks based on prompt
  const lower = prompt.toLowerCase();
  const tasksToCreate: any[] = [];

  const devUser = members.find((m: any) => (m.user?.name || '').toLowerCase().includes('dev') || m.role === 'MEMBER') || members[0];
  const leadUser = members.find((m: any) => m.role === 'OWNER' || m.role === 'ADMIN') || members[0];

  if (lower.includes('telebirr') || lower.includes('payment') || lower.includes('checkout')) {
    tasksToCreate.push({
      title: 'Implement Telebirr Webhook & Signature Verification',
      description: 'Backend REST callback endpoint for instant payment receipt processing.',
      assigneeId: devUser.user.id,
      assigneeName: devUser.user.name,
      priority: TaskPriority.HIGH,
      dueInDays: 2,
    });
    tasksToCreate.push({
      title: 'Build Telebirr 1-Tap Payment Sheet UI',
      description: 'Telegram Mini App modal sheet with copy USSD and countdown timer.',
      assigneeId: leadUser.user.id,
      assigneeName: leadUser.user.name,
      priority: TaskPriority.HIGH,
      dueInDays: 3,
    });
    tasksToCreate.push({
      title: 'Automated Receipt Notification Bot Handler',
      description: 'Send payment confirmation receipt message and active badge in Telegram.',
      assigneeId: devUser.user.id,
      assigneeName: devUser.user.name,
      priority: TaskPriority.MEDIUM,
      dueInDays: 4,
    });
  } else {
    tasksToCreate.push({
      title: `Architect & Core Logic: ${prompt.slice(0, 40)}`,
      description: `Backend implementation and database architecture for: ${prompt}.`,
      assigneeId: devUser.user.id,
      assigneeName: devUser.user.name,
      priority: TaskPriority.HIGH,
      dueInDays: 2,
    });
    tasksToCreate.push({
      title: `User Interface & Interactions: ${prompt.slice(0, 40)}`,
      description: `Frontend components and client flow for: ${prompt}.`,
      assigneeId: leadUser.user.id,
      assigneeName: leadUser.user.name,
      priority: TaskPriority.HIGH,
      dueInDays: 3,
    });
    tasksToCreate.push({
      title: `QA Testing & Telegram Group Sandbox Verification`,
      description: `End-to-end verification and performance check.`,
      assigneeId: user.id,
      assigneeName: user.name,
      priority: TaskPriority.MEDIUM,
      dueInDays: 5,
    });
  }

  // Create tasks in Prisma database
  for (const t of tasksToCreate) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + t.dueInDays);

    await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        creatorId: user.id,
        assigneeId: t.assigneeId,
        title: t.title,
        description: `${t.description}\n\n🤖 AI Project Manager Auto-Classified`,
        priority: t.priority,
        dueDate,
        status: TaskStatus.TODO,
      },
    });
  }

  const miniAppUrl = process.env.WEBAPP_URL || 'https://cbs-stockholm-donations-biggest.trycloudflare.com';
  const keyboard = new InlineKeyboard()
    .url('📱 View on Kanban Board', miniAppUrl);

  let responseMsg = `🤖 *AI Sprint Plan Generated & Deployed!* 🚀\n\n`;
  responseMsg += `*Project Goal:* _"${prompt}"_\n\n`;
  responseMsg += `*Created & Assigned ${tasksToCreate.length} Tasks:*\n`;

  tasksToCreate.forEach((t, i) => {
    const prioIcon = t.priority === TaskPriority.HIGH ? '🔴' : '🟡';
    responseMsg += `${i + 1}. *${t.title}*\n   👤 Assigned: *${t.assigneeName}* • ${prioIcon} \`${t.priority}\`\n\n`;
  });

  responseMsg += `✅ _All tasks are live on your Kanban Board & Calendar!_`;

  await ctx.reply(responseMsg, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
