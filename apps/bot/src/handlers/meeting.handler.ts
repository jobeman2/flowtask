import { Context, InlineKeyboard } from 'grammy';
import { prisma, MeetingPlatform, MeetingStatus } from '@flowtask/database';
import { botConfig } from '../config/bot.config';
import { escapeMarkdown } from '../utils/markdown';

export async function handleMeetingCommand(ctx: Context) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const rawText = ctx.message?.text || '';
  const args = rawText
    .replace(/^\/(meeting|meet|call|schedule_call)(@\w+)?/i, '')
    .trim();

  // Find user's workspace
  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId: tgUser.id.toString() },
    include: {
      user: {
        include: {
          workspaceMembers: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            include: { workspace: true },
          },
        },
      },
    },
  });

  if (!account || !account.user.workspaceMembers.length) {
    await ctx.reply('⚠️ Please run /start in DM first to link your account.');
    return;
  }

  const workspace = account.user.workspaceMembers[0].workspace;
  const user = account.user;
  const miniAppUrl = botConfig.webAppUrl;

  if (!args) {
    const keyboard = new InlineKeyboard()
      .url('📅 Open Meeting Scheduler', miniAppUrl)
      .row()
      .text('⚡ Today 3:00 PM Standup', 'quick_meet_today_3pm')
      .text('⚡ Tomorrow 10:00 AM', 'quick_meet_tomorrow_10am');

    await ctx.reply(
      `🎤 *FlowTask Meeting Scheduler*\n\n` +
      `Schedule calls, standups, and video syncs with automated team alerts.\n\n` +
      `*Usage Examples:*\n` +
      `\u2022 \`/meeting 10:00 AM Sprint Planning\`\n` +
      `\u2022 \`/meeting Tomorrow 3pm Design Review https://meet.google.com/xyz\`\n` +
      `\u2022 \`/meeting Friday 2:00 PM Client Sync\`\n\n` +
      `Or tap below to open the interactive meeting scheduler:`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
    return;
  }

  // --- Parse meeting info ---
  let meetingTime: Date = new Date();
  let title = 'Team Standup & Sync';
  let meetUrl: string | null = null;
  let platform: MeetingPlatform = MeetingPlatform.TELEGRAM;
  const duration = 30;

  // Extract URL
  const urlMatch = args.match(/(https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    meetUrl = urlMatch[1];
    if (meetUrl.includes('meet.google')) platform = MeetingPlatform.GOOGLE_MEET;
    else if (meetUrl.includes('zoom')) platform = MeetingPlatform.ZOOM;
    else if (meetUrl.includes('teams.microsoft')) platform = MeetingPlatform.MICROSOFT_TEAMS;
    else platform = MeetingPlatform.OTHER;
  }

  let cleanArgs = args.replace(/(https?:\/\/[^\s]+)/i, '').trim();

  // Tomorrow offset
  if (/\btomorrow\b/i.test(cleanArgs)) {
    meetingTime.setDate(meetingTime.getDate() + 1);
    cleanArgs = cleanArgs.replace(/\btomorrow\b/i, '').trim();
  }

  // Weekday parsing
  const weekdayMap: Record<string, number> = {
    sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2,
    wednesday: 3, wed: 3, thursday: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
  };
  const weekdayMatch = cleanArgs.match(/\b(monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/i);
  if (weekdayMatch) {
    const target = weekdayMap[weekdayMatch[1].toLowerCase()];
    const now = new Date();
    const curr = now.getDay();
    const diff = ((target - curr + 7) % 7) || 7;
    meetingTime = new Date(now.getTime());
    meetingTime.setDate(meetingTime.getDate() + diff);
    cleanArgs = cleanArgs.replace(weekdayMatch[0], '').trim();
  }

  // Time parsing
  const timeMatch = cleanArgs.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridian = timeMatch[3]?.toLowerCase() ?? null;
    if (meridian === 'pm' && hours < 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;
    meetingTime.setHours(hours, minutes, 0, 0);
    cleanArgs = cleanArgs.replace(timeMatch[0], '').trim();
  } else {
    meetingTime.setHours(meetingTime.getHours() + 1, 0, 0, 0);
  }

  if (cleanArgs.length > 0) title = cleanArgs;

  const formattedTime = meetingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedDate = meetingTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const platformName = platform === MeetingPlatform.GOOGLE_MEET ? 'Google Meet'
    : platform === MeetingPlatform.ZOOM ? 'Zoom'
    : platform === MeetingPlatform.MICROSOFT_TEAMS ? 'Microsoft Teams'
    : '🎤 Telegram Voice Chat';

  // --- Save to Meeting table ---
  const meeting = await prisma.meeting.create({
    data: {
      workspaceId: workspace.id,
      organizerId: user.id,
      title,
      description: [
        `🎤 Platform: ${platformName}`,
        meetUrl ? `🔗 Join URL: ${meetUrl}` : null,
        `⏱️ Duration: ${duration} mins`,
        `📅 Scheduled: ${formattedDate} at ${formattedTime}`,
      ].filter(Boolean).join('\n'),
      platform,
      meetUrl,
      scheduledAt: meetingTime,
      durationMins: duration,
      status: MeetingStatus.SCHEDULED,
    },
  });

  // Schedule a reminder 15 mins before (only if meeting is in the future)
  const reminderAt = new Date(meetingTime.getTime() - 15 * 60_000);
  if (reminderAt > new Date()) {
    await prisma.meetingReminder.create({
      data: { meetingId: meeting.id, remindAt: reminderAt },
    });
  }

  const keyboard = new InlineKeyboard();
  if (meetUrl) keyboard.url('🔗 Join Video Call', meetUrl).row();
  keyboard
    .text('🔔 Set Reminder', `meeting:notify:${meeting.id}`)
    .row()
    .url('📱 Open in FlowTask', miniAppUrl);

  const announcement =
    `🗓️ *NEW MEETING SCHEDULED!* 🎤\n\n` +
    `📌 *Topic:* ${escapeMarkdown(title)}\n` +
    `⏰ *When:* ${formattedDate} at *${formattedTime}*\n` +
    `⏱️ *Duration:* ${duration} mins\n` +
    `🌐 *Platform:* ${platformName}\n` +
    `👤 *Host:* ${escapeMarkdown(user.name || tgUser.first_name)}\n\n` +
    `🔔 _A reminder will fire 15 minutes before the meeting starts._`;

  await ctx.reply(announcement, { parse_mode: 'Markdown', reply_markup: keyboard });
}
