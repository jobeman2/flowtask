import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus, TaskPriority } from '@flowtask/database';

export async function handleMeetingCommand(ctx: Context) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const rawText = ctx.message?.text || '';
  // Syntax: /meeting [time/date] [Title] [URL/Platform]
  // Examples:
  // /meeting Tomorrow 10:00 AM Sprint Review https://meet.google.com/abc-defg-hij
  // /meeting 3:00 PM Team Standup

  const args = rawText.replace(/^\/meeting(@\w+)?/i, '').replace(/^\/meet(@\w+)?/i, '').trim();

  // Find user's workspace
  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId: tgUser.id.toString() },
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
    await ctx.reply('⚠️ Please run /start in DM with @flowtaskmanager_bot first to link your account.');
    return;
  }

  const workspace = account.user.workspaceMembers[0].workspace;
  const user = account.user;

  if (!args) {
    // Show quick usage guide
    const miniAppUrl = process.env.WEBAPP_URL || 'https://cbs-stockholm-donations-biggest.trycloudflare.com';
    const keyboard = new InlineKeyboard()
      .url('📅 Open Meeting Scheduler', miniAppUrl)
      .row()
      .text('⚡ Schedule Today 3:00 PM', 'quick_meet_today_3pm')
      .text('⚡ Tomorrow 10:00 AM', 'quick_meet_tomorrow_10am');

    await ctx.reply(
      `🎙️ *FlowTask Meeting Scheduler*\n\n` +
      `Schedule calls, standups, and video syncs with automated team alerts.\n\n` +
      `*Usage Examples:*\n` +
      `• \`/meeting 10:00 AM Sprint Planning\`\n` +
      `• \`/meeting Tomorrow 3pm Design Review https://meet.google.com/xyz\`\n` +
      `• \`/meeting Friday 2:00 PM Client Sync (Telegram Voice Call)\`\n\n` +
      `Or tap below to open the interactive meeting scheduler with agenda notes & attendee picker:`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
    return;
  }

  // Parse meeting info
  let meetingTime: Date = new Date();
  let title = 'Team Standup & Sync';
  let meetUrl = 'Telegram Group Call';
  let duration = '30 mins';

  // Check for URL in text
  const urlMatch = args.match(/(https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    meetUrl = urlMatch[1];
  }

  // Clean title
  let cleanArgs = args.replace(/(https?:\/\/[^\s]+)/i, '').trim();

  // Basic time inference
  const lower = cleanArgs.toLowerCase();
  if (lower.includes('tomorrow')) {
    meetingTime.setDate(meetingTime.getDate() + 1);
    cleanArgs = cleanArgs.replace(/tomorrow/i, '').trim();
  }

  const timeMatch = cleanArgs.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridian = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

    if (meridian === 'pm' && hours < 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;

    meetingTime.setHours(hours, minutes, 0, 0);
    cleanArgs = cleanArgs.replace(timeMatch[0], '').trim();
  } else {
    // Default to next hour
    meetingTime.setHours(meetingTime.getHours() + 1, 0, 0, 0);
  }

  if (cleanArgs.length > 0) {
    title = cleanArgs;
  }

  // Create Meeting in Database as a Scheduled Event Task
  const formattedTimeStr = meetingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedDateStr = meetingTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const isLink = meetUrl.startsWith('http');
  const platformName = isLink
    ? meetUrl.includes('meet.google') ? 'Google Meet' : meetUrl.includes('zoom') ? 'Zoom' : 'Video Conference'
    : '🎙️ Telegram Voice Chat';

  await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      creatorId: user.id,
      assigneeId: user.id,
      title: `[Meeting] ${title}`,
      description: `🎙️ Platform: ${platformName}\n🔗 Join URL: ${meetUrl}\n⏱️ Duration: ${duration}\n📅 Scheduled for: ${formattedDateStr} at ${formattedTimeStr}\n\n📋 Agenda:\n• Review sprint progress and blockers\n• Action items alignment`,
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      dueDate: meetingTime,
    },
  });

  const miniAppUrl = process.env.WEBAPP_URL || 'https://cbs-stockholm-donations-biggest.trycloudflare.com';
  const keyboard = new InlineKeyboard();
  
  if (isLink) {
    keyboard.url('🔗 Join Video Call', meetUrl).row();
  }
  keyboard.url('📱 Open in FlowTask', miniAppUrl);

  const announcement =
    `🗓️ *NEW MEETING SCHEDULED!* 🎙️\n\n` +
    `📌 *Topic:* ${title}\n` +
    `⏰ *When:* ${formattedDateStr} at *${formattedTimeStr}*\n` +
    `⏱️ *Duration:* ${duration}\n` +
    `🌐 *Platform:* ${platformName}\n` +
    `👤 *Host:* ${user.name || tgUser.first_name}\n\n` +
    `🔔 _Automated reminder will alert this group 15 minutes before call start._`;

  await ctx.reply(announcement, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
