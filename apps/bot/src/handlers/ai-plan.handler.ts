import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus, TaskPriority } from '@flowtask/database';
import { botConfig } from '../config/bot.config';
import { escapeMarkdown } from '../utils/markdown';
import { generateSprintPlan } from '../services/gemini.service';

async function getUserWorkspace(ctx: Context) {
  const tgUser = ctx.from;
  if (!tgUser) return null;

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
                  members: { include: { user: true } },
                  subscription: { include: { plan: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!account || !account.user.workspaceMembers.length) return null;

  return {
    account,
    user: account.user,
    workspace: account.user.workspaceMembers[0].workspace,
    members: account.user.workspaceMembers[0].workspace.members,
    subscription: account.user.workspaceMembers[0].workspace.subscription,
  };
}

export async function handleAiPlanCommand(ctx: Context) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const rawText = ctx.message?.text || '';
  const prompt = rawText.replace(/^\/(ai|plan|copilot|pm)(@\w+)?/i, '').trim();
  const miniAppUrl = botConfig.webAppUrl;

  const ctx_data = await getUserWorkspace(ctx);
  if (!ctx_data) {
    await ctx.reply('⚠️ Please run /start in DM with the bot first to link your account.');
    return;
  }

  const { user, workspace, members, subscription } = ctx_data;

  // Check subscription — AI is a paid feature (PRO or TEAM plan)
  const planCode = (subscription as any)?.plan?.code || 'FREE';
  const hasAiAccess = planCode !== 'FREE';

  if (!hasAiAccess) {
    const keyboard = new InlineKeyboard()
      .url('⭐ Upgrade to PRO', miniAppUrl)
      .row();
    await ctx.reply(
      `🔒 *AI Project Manager is a PRO Feature*\n\n` +
      `The AI Project Manager is only available on PRO and TEAM plans.\n\n` +
      `Upgrade your workspace to unlock:\n` +
      `• 🤖 AI task generation from natural language\n` +
      `• 🧠 Smart team assignment\n` +
      `• 📋 Sprint planning from a single prompt`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
    return;
  }

  if (!prompt) {
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
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
    return;
  }

  await ctx.reply('🤖 *AI Project Manager is analyzing your idea...*', {
    parse_mode: 'Markdown',
  });

  // Call Gemini AI — falls back to rule-based if GEMINI_API_KEY is not set
  const tasksToCreate = await generateSprintPlan(prompt, members as any);

  for (const t of tasksToCreate) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + t.dueInDays);

    await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        creatorId: user.id,
        assigneeId: t.assigneeId || user.id,
        title: t.title,
        description: `${t.description}\n\n🤖 AI Project Manager`,
        priority: t.priority,
        dueDate,
        status: TaskStatus.TODO,
      },
    });
  }

  const keyboard = new InlineKeyboard()
    .url('📱 View on Kanban Board', miniAppUrl);

  let responseMsg = `🤖 *AI Sprint Plan Generated & Deployed!* 🚀\n\n`;
  responseMsg += `*Project Goal:* _"${escapeMarkdown(prompt)}"_\n\n`;
  responseMsg += `*Created & Assigned ${tasksToCreate.length} Tasks:*\n`;

  tasksToCreate.forEach((t, i) => {
    const prioIcon = t.priority === TaskPriority.URGENT ? '🚨'
      : t.priority === TaskPriority.HIGH ? '🔴' : '🟡';
    responseMsg += `${i + 1}. *${escapeMarkdown(t.title)}*\n   👤 *${escapeMarkdown(t.assigneeName)}* • ${prioIcon} \`${t.priority}\`\n\n`;
  });

  responseMsg += `✅ _All tasks are live on your Kanban Board & Calendar!_`;

  await ctx.reply(responseMsg, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
