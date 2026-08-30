import { Context, InlineKeyboard } from 'grammy';

export async function handleHelp(ctx: Context) {
  const username = ctx.me?.username || 'flowtaskmanager_bot';
  const escapedUsername = username.replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\$&');

  const helpText = `📋 *FlowTask Deterministic Commands Guide*

*Task & Meeting Management:*
/task \\<title\\> \\- Quickly create a new task
/meeting \\<time\\> \\<topic\\> \\- Schedule calls & Google Meet with team alerts
/tasks \\- View all tasks with status filters & pagination
/today \\- View tasks scheduled or due today
/overdue \\- View overdue tasks requiring attention
/upcoming \\- View 7\\-day upcoming schedule forecast
/done \\<id\\> \\- Mark task as completed

*Workspaces & Teams:*
/workspace \\- Manage & switch workspaces
/switch \\- Toggle between Internal Team & Client Collab

*⚡ Smart Deterministic Syntax \\(Zero AI\\):*
You can add tags anywhere in your task message:
• *Priorities:* \`!urgent\`, \`!high\`, \`!med\`, \`!low\`, \`p1\`\\-\`p4\`
• *Deadlines:* \`today\`, \`tonight\`, \`tomorrow\`, \`next monday\`, \`at 5pm\`, \`due:2026-08-30\`
• *Recurrence:* \`daily\`, \`every week\`, \`every month\`, \`every friday\`
• *Reminders:* \`remind:15m\`, \`remind:1h\`, \`remind:1d\`
• *Projects & Labels:* \`+Marketing\`, \`#urgent\`, \`@username\`

*Examples:*
• \`/task Client Review !urgent +Design #v1 tomorrow 4pm\`
• \`/task Team Standup every monday 10am remind:15m\`

💡 *Tip:* Add @${escapedUsername} to your groups to manage team & client tasks collaboratively\\!`;

  const keyboard = new InlineKeyboard()
    .text('📝 View Active Tasks', 'tasks:filter:PENDING:1')
    .text('🏢 Switch Workspace', 'action:workspace_menu');

  await ctx.reply(helpText, {
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard,
  });
}
